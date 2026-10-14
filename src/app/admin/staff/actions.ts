"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { BookingError } from "@/lib/reservations";

const role = z.enum(["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"]);
const password = z.string().min(8, "Password must have at least 8 characters").regex(/[A-Za-z]/, "Password needs a letter").regex(/\d/, "Password needs a number");

export async function createStaffAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const admin = await assertPermission("staff");
    const d = z
      .object({ name: z.string().trim().min(2).max(80), email: z.email().trim().toLowerCase(), phone: z.string().trim().max(30), role, password })
      .parse(Object.fromEntries(formData));
    if (await db.user.findUnique({ where: { email: d.email } })) throw new BookingError("An account with this email already exists.");
    const user = await db.user.create({ data: { name: d.name, email: d.email, phone: d.phone || null, role: d.role, passwordHash: await bcrypt.hash(d.password, 10) } });
    await audit({ userId: admin.id, action: "user.create", entity: "User", entityId: user.id, summary: `Created ${ROLE_LABELS[d.role].toLowerCase()} account for ${d.name}` });
    revalidatePath("/admin/staff");
    return `${d.name} can now sign in.`;
  });
}

export async function updateStaffAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const admin = await assertPermission("staff");
    const d = z
      .object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(30), role, active: z.string().optional() })
      .parse(Object.fromEntries(formData));
    const active = d.active === "on";
    if (id === admin.id && (!active || d.role !== "ADMIN")) throw new BookingError("You cannot deactivate or demote your own account.");
    const user = await db.user.update({ where: { id }, data: { name: d.name, phone: d.phone || null, role: d.role, active } });
    await audit({ userId: admin.id, action: "user.update", entity: "User", entityId: id, summary: `Updated ${user.name}: ${ROLE_LABELS[d.role]}${active ? "" : ", deactivated"}` });
    revalidatePath("/admin/staff");
    return `${user.name} updated.`;
  });
}

export async function resetPasswordAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const admin = await assertPermission("staff");
    const pw = password.parse(formData.get("password"));
    const user = await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
    await audit({ userId: admin.id, action: "user.password", entity: "User", entityId: id, summary: `Reset password for ${user.name}` });
    return `Password reset for ${user.name}.`;
  });
}
