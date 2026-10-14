"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { canGuestView, unlockReservation } from "@/lib/guest-access";
import { sendReservationEmail } from "@/lib/notifications";
import { BookingError, cancelReservation } from "@/lib/reservations";

export type LookupState = { error?: string } | null;

export async function lookupBooking(_: LookupState, formData: FormData): Promise<LookupState> {
  const parsed = z
    .object({ code: z.string().trim().toUpperCase().min(4), email: z.email().trim().toLowerCase() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your confirmation number and the email used for the booking." };

  const r = await db.reservation.findUnique({ where: { code: parsed.data.code }, include: { guest: { select: { email: true } } } });
  // Same message for both cases so the form cannot be used to probe for valid codes.
  if (!r || r.guest.email?.toLowerCase() !== parsed.data.email) {
    return { error: "We couldn't find a reservation matching these details." };
  }
  await unlockReservation(r.code);
  redirect(`/manage-booking?code=${r.code}`);
}

export type CancelState = { error?: string; success?: string } | null;

export async function guestCancel(_: CancelState, formData: FormData): Promise<CancelState> {
  const code = String(formData.get("code") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelled by guest online";
  const r = await db.reservation.findUnique({ where: { code } });
  if (!r || !(await canGuestView(r))) return { error: "Reservation not found." };
  const user = await getCurrentUser();
  try {
    const { refunded } = await cancelReservation(r.id, { userId: user?.id ?? null, reason });
    after(() => sendReservationEmail(r.id, "cancellation", { refunded }));
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath("/manage-booking");
  revalidatePath("/account");
  return { success: "Your reservation has been cancelled. A confirmation email is on its way." };
}
