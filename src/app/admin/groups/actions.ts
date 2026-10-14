"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { sendGroupEmail, type ReservationEmailKind } from "@/lib/notifications";
import { BookingError, cancelGroup, checkInGroup, recordGroupPayment } from "@/lib/reservations";

const refresh = () => revalidatePath("/admin", "layout");

export async function groupPaymentAction(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
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
    const card = d.method === "CARD" && d.cardNumber ? { number: d.cardNumber, expiry: d.cardExpiry ?? "", cvc: d.cardCvc ?? "", name: d.cardName || "Card holder" } : undefined;
    await recordGroupPayment(groupId, { amount: d.amount, method: d.method, note: d.note, card }, user.id);
    refresh();
    return `Payment of ${formatMoney(d.amount)} recorded and split across the rooms.`;
  });
}

export async function checkInGroupAction(groupId: string): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("frontDesk");
    const results = await checkInGroup(groupId, user.id);
    refresh();
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (results.length === 0) throw new BookingError("No rooms of this group are waiting to check in.");
    if (failed.length) {
      if (ok === 0) throw new BookingError(failed.map((f) => `${f.code}: ${f.message}`).join(" "));
      return `Checked in ${ok} of ${results.length} rooms. Not checked in — ${failed.map((f) => `${f.code}: ${f.message}`).join(" ")}`;
    }
    return `All ${ok} rooms checked in.`;
  });
}

export async function cancelGroupAction(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    const reason = String(formData.get("reason") || "Cancelled by hotel");
    const { refunded, fees, cancelled } = await cancelGroup(groupId, { userId: user.id, reason, waiveFee: formData.get("waiveFee") === "on" });
    if (formData.get("notify") === "on") after(() => sendGroupEmail(groupId, "cancellation", { refunded }));
    refresh();
    return `Cancelled ${cancelled} rooms${fees ? ` (${fees} with first-night fee)` : ""}${refunded ? `, ${formatMoney(refunded)} refunded` : ""}.`;
  });
}

export async function updateGroupAction(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    const d = z
      .object({ name: z.string().trim().min(2).max(100), companyId: z.string().optional(), singleBill: z.string().optional(), notes: z.string().max(1000).optional() })
      .parse(Object.fromEntries(formData));
    const g = await db.reservationGroup.findUniqueOrThrow({ where: { id: groupId }, include: { invoice: true } });
    const singleBill = d.singleBill === "on";
    if (g.invoice && !singleBill) throw new BookingError(`Group invoice ${g.invoice.number} has already been issued; the group stays on one bill.`);
    const companyId = d.companyId || null;
    await db.$transaction(async (tx) => {
      await tx.reservationGroup.update({ where: { id: groupId }, data: { name: d.name, companyId, singleBill, notes: d.notes || null } });
      // Rooms follow the group's company for invoicing.
      await tx.reservation.updateMany({ where: { groupId }, data: { companyId } });
      await audit({ userId: user.id, action: "group.update", entity: "ReservationGroup", entityId: groupId, summary: `Updated group ${g.code}: ${singleBill ? "one bill" : "separate bills"}${companyId ? ", company billing" : ""}` }, tx);
    });
    refresh();
    return "Group updated.";
  });
}

export async function groupEmailAction(groupId: string, kind: ReservationEmailKind): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reservations");
    if (!(await sendGroupEmail(groupId, kind))) throw new BookingError("The email could not be sent. Check the booker's email address.");
    await audit({ userId: user.id, action: "email.send", entity: "ReservationGroup", entityId: groupId, summary: `Sent group ${kind} email` });
    refresh();
    return "Email sent.";
  });
}
