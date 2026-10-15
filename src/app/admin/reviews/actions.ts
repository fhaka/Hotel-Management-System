"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { sendReviewRequest } from "@/lib/notifications";
import { BookingError } from "@/lib/reservations";

const refresh = () => revalidatePath("/", "layout");

export async function setReviewStatusAction(id: string, status: "PUBLISHED" | "HIDDEN" | "PENDING"): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reviews");
    const review = await db.review.update({ where: { id }, data: { status } });
    const verb = { PUBLISHED: "Published", HIDDEN: "Hid", PENDING: "Moved back to pending" }[status];
    await audit({ userId: user.id, action: `review.${status.toLowerCase()}`, entity: "Review", entityId: id, summary: `${verb} review "${review.title}" by ${review.guestName}` });
    refresh();
    return status === "PUBLISHED" ? "Review published on the website." : status === "HIDDEN" ? "Review hidden from the website." : "Review moved back to pending.";
  });
}

export async function replyReviewAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reviews");
    const response = z.string().trim().max(2000).parse(formData.get("response") ?? "");
    const publish = formData.get("publish") === "on";
    const review = await db.review.update({
      where: { id },
      data: {
        response: response || null,
        respondedAt: response ? new Date() : null,
        respondedById: response ? user.id : null,
        ...(publish ? { status: "PUBLISHED" as const } : {}),
      },
    });
    await audit({ userId: user.id, action: "review.reply", entity: "Review", entityId: id, summary: response ? `Replied to review by ${review.guestName}` : `Removed reply to review by ${review.guestName}` });
    refresh();
    return response ? (publish ? "Reply saved and review published." : "Reply saved.") : "Reply removed.";
  });
}

export async function sendReviewRequestAction(reservationId: string): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("reviews");
    const r = await db.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { review: true, guest: true } });
    if (r.status !== "CHECKED_OUT") throw new BookingError("Review requests can be sent after check-out.");
    if (r.review) throw new BookingError("The guest has already reviewed this stay.");
    if (!(await sendReviewRequest(reservationId))) throw new BookingError("The email could not be sent. Check the guest's email address.");
    await audit({ userId: user.id, action: "email.send", entity: "Reservation", entityId: reservationId, summary: `Sent review request to ${r.guest.email}` });
    refresh();
    return "Review request sent.";
  });
}
