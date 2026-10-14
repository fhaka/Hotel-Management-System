"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { BookingError } from "@/lib/reservations";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120),
  taxId: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z0-9-]{5,20}$/, "Tax number should be 5–20 letters or digits")]),
  contactName: z.string().trim().max(80),
  email: z.union([z.literal(""), z.email("Invalid email")]),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(160),
  city: z.string().trim().max(80),
  country: z.string().trim().max(60),
  notes: z.string().trim().max(1000),
});

function toData(d: z.infer<typeof schema>) {
  const blank = (v: string) => v || null;
  return {
    name: d.name,
    taxId: d.taxId ? d.taxId.toUpperCase() : null,
    contactName: blank(d.contactName),
    email: d.email ? d.email.toLowerCase() : null,
    phone: blank(d.phone),
    address: blank(d.address),
    city: blank(d.city),
    country: blank(d.country),
    notes: blank(d.notes),
  };
}

async function ensureUniqueTaxId(taxId: string | null, exceptId?: string) {
  if (!taxId) return;
  const clash = await db.company.findUnique({ where: { taxId } });
  if (clash && clash.id !== exceptId) throw new BookingError(`${clash.name} already uses tax number ${taxId}.`);
}

export async function saveCompanyAction(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const result = await attempt(async () => {
    const user = await assertPermission("guests");
    const data = toData(schema.parse(Object.fromEntries(formData)));
    await ensureUniqueTaxId(data.taxId, id ?? undefined);
    const company = id ? await db.company.update({ where: { id }, data }) : await db.company.create({ data });
    await audit({ userId: user.id, action: id ? "company.update" : "company.create", entity: "Company", entityId: company.id, summary: `${id ? "Updated" : "Created"} company ${company.name}` });
    revalidatePath("/admin/companies", "layout");
    return id ? `${company.name} saved.` : `/admin/companies/${company.id}`;
  });
  if (result?.success?.startsWith("/admin/")) redirect(result.success);
  return result;
}

/** Bills a single reservation to a company (or back to the guest). */
export async function setReservationCompanyAction(reservationId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("billing");
    const companyId = String(formData.get("companyId") || "") || null;
    const r = await db.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { invoice: true, group: true } });
    if (r.group) throw new BookingError("This room belongs to a group — change billing on the group instead.");
    if (r.invoice) throw new BookingError(`Invoice ${r.invoice.number} has already been issued. Billing details can't change after invoicing.`);
    const company = companyId ? await db.company.findUniqueOrThrow({ where: { id: companyId } }) : null;
    await db.reservation.update({ where: { id: reservationId }, data: { companyId } });
    await audit({ userId: user.id, action: "reservation.billing", entity: "Reservation", entityId: reservationId, summary: company ? `Billing ${r.code} to ${company.name}` : `Billing ${r.code} to the guest` });
    revalidatePath("/admin", "layout");
    return company ? `Invoice will be issued to ${company.name}.` : "Invoice will be issued to the guest.";
  });
}
