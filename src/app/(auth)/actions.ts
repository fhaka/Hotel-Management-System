"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { homeFor, isStaff } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email/mailer";
import { welcomeEmail } from "@/lib/email/templates";
import { getSettings } from "@/lib/settings";

export type AuthState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

async function startSession(user: { id: string; role: Parameters<typeof homeFor>[0]; name: string }) {
  const token = await signSession({ userId: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !valid) return { error: "The email or password is incorrect." };
  if (!user.active) return { error: "This account has been deactivated. Please contact the hotel." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user);
  if (isStaff(user.role)) await audit({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id, summary: `${user.name} signed in` });

  const next = safeNext(formData.get("next"));
  const allowedNext = next && (isStaff(user.role) || !next.startsWith("/admin")) ? next : null;
  redirect(allowedNext ?? homeFor(user.role));
}

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(60),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    phone: z.string().trim().max(30).optional(),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match." });

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { firstName, lastName, email, phone, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return { fieldErrors: { email: ["An account with this email already exists. Sign in instead."] } };
  }

  const name = `${firstName} ${lastName}`;
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name, phone: phone || null, role: "GUEST", passwordHash: await bcrypt.hash(password, 10) },
    });
    // Link to an existing guest profile (e.g. from a previous booking) or create one.
    const existing = await tx.guest.findUnique({ where: { email } });
    if (existing) {
      await tx.guest.update({ where: { id: existing.id }, data: { userId: created.id, phone: existing.phone ?? (phone || null) } });
    } else {
      await tx.guest.create({ data: { firstName, lastName, email, phone: phone || null, userId: created.id } });
    }
    return created;
  });

  const hotel = await getSettings();
  await sendEmail({ to: email, template: "welcome", ...welcomeEmail(firstName, hotel) });
  await startSession(user);
  redirect(safeNext(formData.get("next")) ?? "/account");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
