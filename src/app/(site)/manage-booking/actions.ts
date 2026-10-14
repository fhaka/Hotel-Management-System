"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { canGuestView, canGuestViewGroup, isGroupCode, unlockReservation } from "@/lib/guest-access";
import { sendGroupEmail, sendReservationEmail } from "@/lib/notifications";
import { BookingError, cancelGroup, cancelReservation } from "@/lib/reservations";

export type LookupState = { error?: string } | null;

export async function lookupBooking(_: LookupState, formData: FormData): Promise<LookupState> {
  const parsed = z
    .object({ code: z.string().trim().toUpperCase().min(4), email: z.email().trim().toLowerCase() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your confirmation number and the email used for the booking." };
  const { code, email } = parsed.data;

  const owner = isGroupCode(code)
    ? (await db.reservationGroup.findUnique({ where: { code }, include: { booker: { select: { email: true } } } }))?.booker
    : (await db.reservation.findUnique({ where: { code }, include: { guest: { select: { email: true } } } }))?.guest;
  // Same message for both cases so the form cannot be used to probe for valid codes.
  if (!owner || owner.email?.toLowerCase() !== email) {
    return { error: "We couldn't find a reservation matching these details." };
  }
  await unlockReservation(code);
  redirect(`/manage-booking?code=${code}`);
}

export type CancelState = { error?: string; success?: string } | null;

export async function guestCancel(_: CancelState, formData: FormData): Promise<CancelState> {
  const code = String(formData.get("code") ?? "").toUpperCase();
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelled by guest online";
  const user = await getCurrentUser();
  try {
    if (isGroupCode(code)) {
      const g = await db.reservationGroup.findUnique({ where: { code } });
      if (!g || !(await canGuestViewGroup(g))) return { error: "Reservation not found." };
      const { refunded } = await cancelGroup(g.id, { userId: user?.id ?? null, reason });
      after(() => sendGroupEmail(g.id, "cancellation", { refunded }));
    } else {
      const r = await db.reservation.findUnique({ where: { code }, include: { group: { select: { code: true } } } });
      if (!r || !(await canGuestView(r))) return { error: "Reservation not found." };
      const { refunded } = await cancelReservation(r.id, { userId: user?.id ?? null, reason });
      after(() => sendReservationEmail(r.id, "cancellation", { refunded }));
    }
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath("/manage-booking");
  revalidatePath("/account");
  return { success: "Your reservation has been cancelled. A confirmation email is on its way." };
}
