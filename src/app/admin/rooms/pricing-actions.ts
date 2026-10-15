"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { normalizePromoCode } from "@/lib/booking-rules";
import { db } from "@/lib/db";
import { isISODate, parseISODate } from "@/lib/dates";
import { BookingError } from "@/lib/reservations";

const refresh = () => revalidatePath("/", "layout");
const optionalDate = z.string().refine((v) => v === "" || isISODate(v), "Invalid date");
const toDate = (v: string) => (v ? parseISODate(v) : null);

const promoSchema = z
  .object({
    code: z.string().transform(normalizePromoCode).pipe(z.string().regex(/^[A-Z0-9-]{3,20}$/, "Use 3–20 letters, digits or dashes")),
    description: z.string().trim().min(3, "Describe the offer").max(160),
    type: z.enum(["PERCENT", "FIXED_PER_NIGHT"]),
    value: z.coerce.number().positive("Enter a discount greater than zero"),
    validFrom: optionalDate,
    validTo: optionalDate,
    stayFrom: optionalDate,
    stayTo: optionalDate,
    minNights: z.coerce.number().int().min(1).max(30),
    maxUses: z.union([z.literal(""), z.coerce.number().int().min(1)]),
    roomTypeIds: z.array(z.string()).default([]),
    active: z.string().optional(),
  })
  .refine((d) => d.type !== "PERCENT" || d.value <= 100, { path: ["value"], message: "A percentage cannot exceed 100" })
  .refine((d) => !d.validFrom || !d.validTo || d.validTo >= d.validFrom, { path: ["validTo"], message: "Booking window ends before it starts" })
  .refine((d) => !d.stayFrom || !d.stayTo || d.stayTo >= d.stayFrom, { path: ["stayTo"], message: "Arrival window ends before it starts" });

export async function savePromoAction(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const d = promoSchema.parse({ ...Object.fromEntries(formData), roomTypeIds: formData.getAll("roomTypeIds") });
    const clash = await db.promoCode.findUnique({ where: { code: d.code } });
    if (clash && clash.id !== id) throw new BookingError(`The code ${d.code} already exists.`);
    const data = {
      code: d.code,
      description: d.description,
      type: d.type,
      value: d.value,
      validFrom: toDate(d.validFrom),
      validTo: toDate(d.validTo),
      stayFrom: toDate(d.stayFrom),
      stayTo: toDate(d.stayTo),
      minNights: d.minNights,
      maxUses: d.maxUses === "" ? null : d.maxUses,
      roomTypeIds: d.roomTypeIds,
      active: id ? d.active === "on" : true,
    };
    const promo = id ? await db.promoCode.update({ where: { id }, data }) : await db.promoCode.create({ data });
    await audit({ userId: user.id, action: id ? "promo.update" : "promo.create", entity: "PromoCode", entityId: promo.id, summary: `${id ? "Updated" : "Created"} promo code ${promo.code}` });
    refresh();
    return `Promo code ${promo.code} saved.`;
  });
}

export async function togglePromoAction(id: string, active: boolean): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const promo = await db.promoCode.update({ where: { id }, data: { active } });
    await audit({ userId: user.id, action: "promo.toggle", entity: "PromoCode", entityId: id, summary: `${active ? "Activated" : "Paused"} promo code ${promo.code}` });
    refresh();
    return `${promo.code} ${active ? "activated" : "paused"}.`;
  });
}

const ruleSchema = z
  .object({
    name: z.string().trim().min(2, "Name the rule").max(80),
    startDate: z.string().refine(isISODate, "Select the first night"),
    endDate: z.string().refine(isISODate, "Select the end date"),
    roomTypeId: z.string().optional(),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
    minNights: z.union([z.literal(""), z.coerce.number().int().min(2, "A minimum stay starts at 2 nights").max(30)]),
    closedToArrival: z.string().optional(),
    stopSell: z.string().optional(),
  })
  .refine((d) => d.endDate > d.startDate, { path: ["endDate"], message: "The end must be after the first night" })
  .refine((d) => d.minNights !== "" || d.closedToArrival || d.stopSell, { path: ["minNights"], message: "Choose at least one restriction" });

export async function saveRuleAction(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const d = ruleSchema.parse({ ...Object.fromEntries(formData), weekdays: formData.getAll("weekdays") });
    const data = {
      name: d.name,
      startDate: parseISODate(d.startDate),
      endDate: parseISODate(d.endDate),
      roomTypeId: d.roomTypeId || null,
      weekdays: d.weekdays.length === 7 ? [] : [...new Set(d.weekdays)].sort(),
      minNights: d.minNights === "" ? null : d.minNights,
      closedToArrival: d.closedToArrival === "on",
      stopSell: d.stopSell === "on",
    };
    const rule = id ? await db.stayRestriction.update({ where: { id }, data }) : await db.stayRestriction.create({ data });
    await audit({ userId: user.id, action: id ? "rule.update" : "rule.create", entity: "StayRestriction", entityId: rule.id, summary: `${id ? "Updated" : "Added"} booking rule "${rule.name}"` });
    refresh();
    return "Booking rule saved. It applies to new online bookings immediately.";
  });
}

export async function toggleRuleAction(id: string, active: boolean): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const rule = await db.stayRestriction.update({ where: { id }, data: { active } });
    await audit({ userId: user.id, action: "rule.toggle", entity: "StayRestriction", entityId: id, summary: `${active ? "Enabled" : "Disabled"} booking rule "${rule.name}"` });
    refresh();
    return `${rule.name} ${active ? "enabled" : "disabled"}.`;
  });
}

export async function deleteRuleAction(id: string): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const rule = await db.stayRestriction.delete({ where: { id } });
    await audit({ userId: user.id, action: "rule.delete", entity: "StayRestriction", entityId: id, summary: `Deleted booking rule "${rule.name}"` });
    refresh();
    return "Booking rule deleted.";
  });
}
