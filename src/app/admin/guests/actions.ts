"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { isISODate, parseISODate } from "@/lib/dates";
import { BookingError } from "@/lib/reservations";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: z.union([z.literal(""), z.email("Invalid email")]),
  phone: z.string().trim().max(30),
  country: z.string().trim().max(60),
  city: z.string().trim().max(80),
  address: z.string().trim().max(160),
  idType: z.string().trim().max(40),
  idNumber: z.string().trim().max(40),
  dateOfBirth: z.string().refine((v) => v === "" || isISODate(v), "Invalid date"),
  notes: z.string().trim().max(2000),
  vip: z.string().optional(),
});

function toData(d: z.infer<typeof schema>) {
  const blank = (v: string) => v || null;
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email ? d.email.toLowerCase() : null,
    phone: blank(d.phone),
    country: blank(d.country),
    city: blank(d.city),
    address: blank(d.address),
    idType: blank(d.idType),
    idNumber: blank(d.idNumber),
    dateOfBirth: d.dateOfBirth ? parseISODate(d.dateOfBirth) : null,
    notes: blank(d.notes),
    vip: d.vip === "on",
  };
}

async function ensureUniqueEmail(email: string | null, exceptId?: string) {
  if (!email) return;
  const clash = await db.guest.findUnique({ where: { email } });
  if (clash && clash.id !== exceptId) throw new BookingError(`Another guest (${clash.firstName} ${clash.lastName}) already uses this email.`);
}

export async function updateGuestAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("guests");
    const data = toData(schema.parse(Object.fromEntries(formData)));
    await ensureUniqueEmail(data.email, id);
    await db.guest.update({ where: { id }, data });
    await audit({ userId: user.id, action: "guest.update", entity: "Guest", entityId: id, summary: `Updated guest profile ${data.firstName} ${data.lastName}` });
    revalidatePath("/admin/guests", "layout");
    return "Guest profile saved.";
  });
}

export async function createGuestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await attempt(async () => {
    const user = await assertPermission("guests");
    const data = toData(schema.parse(Object.fromEntries(formData)));
    await ensureUniqueEmail(data.email);
    const guest = await db.guest.create({ data });
    await audit({ userId: user.id, action: "guest.create", entity: "Guest", entityId: guest.id, summary: `Created guest ${data.firstName} ${data.lastName}` });
    return `/admin/guests/${guest.id}`;
  });
  if (result?.success?.startsWith("/admin/")) redirect(result.success);
  return result;
}
