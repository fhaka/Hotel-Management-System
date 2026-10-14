"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/dal";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isISODate, parseISODate, toISODate, today } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/format";
import { sendReservationEmail, type ReservationEmailKind } from "@/lib/notifications";
import {
  BookingError,
  assignRoom,
  cancelReservation,
  checkIn,
  checkOut,
  createReservation,
  markNoShow,
  modifyStay,
  postCharge,
  recordPayment,
  refundCredit,
  voidCharge,
} from "@/lib/reservations";
import { summarizeFolio } from "@/lib/folio";

const refresh = () => revalidatePath("/admin", "layout");

export async function checkInAction(id: string, force = false): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("frontDesk");
    const room = await checkIn(id, user.id, { force });
    refresh();
    return `Checked in to room ${room.number}.`;
  });
}

export async function checkOutAction(id: string): Promise<ActionState> {
  // Refresh even when blocked: an early departure may already have re-priced the folio.
  refresh();
  return attempt(async () => {
    const user = await assertPermission("frontDesk");
    const invoice = await checkOut(id, user.id);
    after(() => sendReservationEmail(id, "checkout"));
    refresh();
    return `Checked out. Invoice ${invoice.number} issued and emailed.`;
  });
}

export async function noShowAction(id: string): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("frontDesk");
    await markNoShow(id, user.id);
    refresh();
    return "Marked as no-show.";
  });
}

export async function cancelAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    const reason = String(formData.get("reason") || "Cancelled by hotel");
    const waiveFee = formData.get("waiveFee") === "on";
    const { refunded, feeCharged } = await cancelReservation(id, { userId: user.id, reason, waiveFee });
    if (formData.get("notify") === "on") after(() => sendReservationEmail(id, "cancellation", { refunded }));
    refresh();
    return `Reservation cancelled${feeCharged ? " with first-night fee" : ""}${refunded ? `, ${formatMoney(refunded)} refunded` : ""}.`;
  });
}

export async function assignRoomAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    const roomId = String(formData.get("roomId") ?? "");
    if (!roomId) throw new BookingError("Select a room.");
    await assignRoom(id, roomId, user.id);
    refresh();
    return "Room assigned.";
  });
}

const staySchema = z
  .object({
    checkIn: z.string().refine(isISODate, "Invalid date"),
    checkOut: z.string().refine(isISODate, "Invalid date"),
    adults: z.coerce.number().int().min(1).max(8),
    children: z.coerce.number().int().min(0).max(6),
    roomTypeId: z.string().min(1),
  })
  .refine((d) => d.checkOut > d.checkIn, { path: ["checkOut"], message: "Check-out must be after check-in." });

export async function modifyStayAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    const d = staySchema.parse(Object.fromEntries(formData));
    await modifyStay(id, { ...d, checkIn: parseISODate(d.checkIn), checkOut: parseISODate(d.checkOut) }, user.id);
    refresh();
    return "Stay updated and re-priced.";
  });
}

export async function updateDetailsAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    const d = z
      .object({ specialRequests: z.string().max(1000), internalNotes: z.string().max(2000), estimatedArrival: z.string().max(20) })
      .parse(Object.fromEntries(formData));
    await db.reservation.update({
      where: { id },
      data: { specialRequests: d.specialRequests || null, internalNotes: d.internalNotes || null, estimatedArrival: d.estimatedArrival || null },
    });
    await audit({ userId: user.id, action: "reservation.notes", entity: "Reservation", entityId: id, summary: "Updated requests & notes" });
    refresh();
    return "Details saved.";
  });
}

export async function postChargeAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("billing");
    const d = z
      .object({
        serviceId: z.string().optional(),
        description: z.string().trim().max(120).optional(),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100),
        unitPrice: z.coerce.number().min(0).max(100_000).optional(),
        type: z.enum(["SERVICE", "OTHER", "DISCOUNT"]).default("SERVICE"),
      })
      .parse(Object.fromEntries(formData));
    let description = d.description;
    let unitPrice = d.unitPrice;
    if (d.serviceId) {
      const service = await db.service.findUniqueOrThrow({ where: { id: d.serviceId } });
      description ||= service.name;
      unitPrice ??= toNumber(service.price);
    }
    if (!description) throw new BookingError("Choose a service or enter a description.");
    if (unitPrice == null || Number.isNaN(unitPrice)) throw new BookingError("Enter a unit price.");
    await postCharge(id, { serviceId: d.serviceId || null, description, quantity: d.quantity, unitPrice, type: d.serviceId ? "SERVICE" : d.type }, user.id);
    refresh();
    return `Posted ${description}.`;
  });
}

export async function voidChargeAction(chargeId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("billing");
    const reason = String(formData.get("reason") || "").trim();
    if (reason.length < 3) throw new BookingError("Enter a reason for voiding this charge.");
    await voidCharge(chargeId, reason, user.id);
    refresh();
    return "Charge voided.";
  });
}

export async function recordPaymentAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("billing");
    const d = z
      .object({
        amount: z.coerce.number().positive("Enter an amount greater than zero."),
        method: z.enum(["CARD", "CASH", "BANK_TRANSFER"]),
        note: z.string().max(200).optional(),
        cardNumber: z.string().optional(),
        cardExpiry: z.string().optional(),
        cardCvc: z.string().optional(),
        cardName: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));
    const card =
      d.method === "CARD" && d.cardNumber
        ? { number: d.cardNumber, expiry: d.cardExpiry ?? "", cvc: d.cardCvc ?? "", name: d.cardName || "Card holder" }
        : undefined;
    await recordPayment(id, { amount: d.amount, method: d.method, note: d.note, card }, user.id);
    refresh();
    return `Payment of ${formatMoney(d.amount)} recorded.`;
  });
}

export async function refundAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("refunds");
    const amount = z.coerce.number().positive("Enter an amount greater than zero.").parse(formData.get("amount"));
    const note = String(formData.get("note") || "Refund");
    const r = await db.reservation.findUniqueOrThrow({ where: { id }, include: { charges: true, payments: true } });
    const folio = summarizeFolio(r);
    const refundable = folio.paid - folio.refunded;
    if (amount > refundable + 0.004) throw new BookingError(`At most ${formatMoney(refundable)} can be refunded.`);
    const refunded = await refundCredit(id, amount, user.id, note);
    await audit({ userId: user.id, action: "payment.refund", entity: "Reservation", entityId: id, summary: `Refunded ${formatMoney(refunded)} on ${r.code}: ${note}` });
    refresh();
    return `Refunded ${formatMoney(refunded)}.`;
  });
}

export async function sendEmailAction(id: string, kind: ReservationEmailKind): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    const ok = await sendReservationEmail(id, kind);
    if (!ok) throw new BookingError("The email could not be sent. Check the guest's email address or mail server.");
    await audit({ userId: user.id, action: "email.send", entity: "Reservation", entityId: id, summary: `Sent ${kind} email` });
    refresh();
    return "Email sent.";
  });
}

const newSchema = z
  .object({
    guestId: z.string().optional(),
    firstName: z.string().trim().max(60).optional(),
    lastName: z.string().trim().max(60).optional(),
    email: z.union([z.literal(""), z.email("Enter a valid email.")]).optional(),
    phone: z.string().trim().max(30).optional(),
    country: z.string().trim().max(60).optional(),
    roomTypeId: z.string().min(1, "Select a room type."),
    roomId: z.string().optional(),
    checkIn: z.string().refine(isISODate, "Select a check-in date."),
    checkOut: z.string().refine(isISODate, "Select a check-out date."),
    adults: z.coerce.number().int().min(1).max(8),
    children: z.coerce.number().int().min(0).max(6),
    source: z.enum(["WEBSITE", "WALK_IN", "PHONE", "EMAIL", "OTA", "CORPORATE"]),
    extras: z.array(z.string()).default([]),
    specialRequests: z.string().max(1000).optional(),
    internalNotes: z.string().max(2000).optional(),
    sendConfirmation: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.guestId && (!d.firstName || !d.lastName)) ctx.addIssue({ code: "custom", path: ["firstName"], message: "Select an existing guest or enter first and last name." });
  });

export async function createReservationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await attempt(async () => {
    const user = await assertPermission("reservations");
    const d = newSchema.parse({ ...Object.fromEntries(formData), extras: formData.getAll("extras") });
    let guest: Parameters<typeof createReservation>[0]["guest"];
    if (d.guestId) guest = { id: d.guestId };
    else if (d.email) guest = { firstName: d.firstName!, lastName: d.lastName!, email: d.email, phone: d.phone, country: d.country };
    else {
      const created = await db.guest.create({ data: { firstName: d.firstName!, lastName: d.lastName!, phone: d.phone || null, country: d.country || null } });
      guest = { id: created.id };
    }
    const r = await createReservation({
      guest,
      roomTypeId: d.roomTypeId,
      roomId: d.roomId || null,
      checkIn: parseISODate(d.checkIn),
      checkOut: parseISODate(d.checkOut),
      adults: d.adults,
      children: d.children,
      source: d.source,
      extraServiceIds: d.extras,
      specialRequests: d.specialRequests,
      internalNotes: d.internalNotes,
      createdById: user.id,
    });
    if (d.sendConfirmation === "on") after(() => sendReservationEmail(r.id, "confirmation"));
    refresh();
    return `/admin/reservations/${r.id}`;
  });
  if (result?.success?.startsWith("/admin/")) redirect(`${result.success}?created=1`);
  return result;
}

/** Emails a pre-arrival message to every confirmed guest arriving tomorrow who hasn't had one yet. */
export async function sendTomorrowRemindersAction(): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("frontDesk");
    const tomorrow = new Date(today().getTime() + 86_400_000);
    const arrivals = await db.reservation.findMany({
      where: { checkIn: tomorrow, status: "CONFIRMED", guest: { email: { not: null } }, emails: { none: { template: "pre-arrival", status: "SENT" } } },
      select: { id: true },
    });
    let sent = 0;
    for (const a of arrivals) if (await sendReservationEmail(a.id, "pre-arrival")) sent++;
    await audit({ userId: user.id, action: "email.reminders", entity: "Reservation", summary: `Sent ${sent} pre-arrival reminders for ${toISODate(tomorrow)}` });
    refresh();
    return sent ? `Sent ${sent} pre-arrival emails for tomorrow's arrivals.` : "All of tomorrow's guests have already been reminded.";
  });
}
