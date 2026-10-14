"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  phone: z.string().trim().max(30).optional(),
  country: z.string().trim().max(60).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(160).optional(),
});

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const data = { firstName: d.firstName, lastName: d.lastName, phone: d.phone || null, country: d.country || null, city: d.city || null, address: d.address || null };

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { name: `${d.firstName} ${d.lastName}`, phone: d.phone || null } });
    if (user.role !== "GUEST") return;
    if (user.guest) await tx.guest.update({ where: { id: user.guest.id }, data });
    else {
      const existing = await tx.guest.findUnique({ where: { email: user.email } });
      if (existing) await tx.guest.update({ where: { id: existing.id }, data: { ...data, userId: user.id } });
      else await tx.guest.create({ data: { ...data, email: user.email, userId: user.id } });
    }
  });
  revalidatePath("/account", "layout");
  return { success: "Your details have been saved." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Use at least 8 characters.").regex(/[A-Za-z]/, "Include a letter.").regex(/\d/, "Include a number."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match." });

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(parsed.data.current, record.passwordHash))) return { fieldErrors: { current: ["Current password is incorrect."] } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) } });
  return { success: "Your password has been updated." };
}
