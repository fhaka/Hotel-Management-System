import "server-only";
import { sendEmail } from "@/lib/email/mailer";
import { bookingConfirmationEmail, cancellationEmail, checkoutEmail, preArrivalEmail, reviewRequestEmail, type EmailReservation } from "@/lib/email/templates";
import { reviewUrl } from "@/lib/reviews";
import { invoiceSourceForGroup, invoiceSourceForReservation, renderInvoicePdf } from "@/lib/pdf/invoice";
import { nightsBetween } from "@/lib/dates";
import { emailData, getGroup, getReservation, summarizeGroup, type FullGroup } from "@/lib/reservations";
import { getSettings } from "@/lib/settings";
import { pluralize, round2 } from "@/lib/format";

export type ReservationEmailKind = "confirmation" | "pre-arrival" | "cancellation" | "checkout";

function groupEmailData(g: FullGroup): EmailReservation {
  const rooms = g.reservations.filter((r) => r.status !== "CANCELLED" || g.reservations.every((x) => x.status === "CANCELLED"));
  const first = rooms[0] ?? g.reservations[0]!;
  const folio = summarizeGroup(g);
  return {
    code: g.code,
    guestFirstName: g.booker.firstName,
    guestEmail: g.booker.email ?? "",
    roomTypeName: pluralize(rooms.length, "room"),
    rooms: rooms.map((r) => `${r.roomType.name} · ${pluralize(r.adults + r.children, "guest")}${r.occupantName ? ` (${r.occupantName})` : ""}`),
    checkIn: first.checkIn,
    checkOut: first.checkOut,
    nights: nightsBetween(first.checkIn, first.checkOut),
    adults: rooms.reduce((s, r) => s + r.adults, 0),
    children: rooms.reduce((s, r) => s + r.children, 0),
    total: folio.total,
    paid: round2(folio.paid - folio.refunded),
    balance: folio.balance,
  };
}

/** Sends one email about a whole group booking to its booker. */
export async function sendGroupEmail(groupId: string, kind: ReservationEmailKind, opts: { refunded?: number } = {}) {
  const [g, hotel] = await Promise.all([getGroup({ id: groupId }), getSettings()]);
  if (!g?.booker.email) return false;
  const data = groupEmailData(g);
  const base = { to: g.booker.email, template: kind, groupId: g.id, reservationId: g.reservations[0]?.id };
  switch (kind) {
    case "confirmation":
      return sendEmail({ ...base, ...bookingConfirmationEmail(data, hotel) });
    case "pre-arrival":
      return sendEmail({ ...base, ...preArrivalEmail(data, hotel) });
    case "cancellation":
      return sendEmail({ ...base, ...cancellationEmail(data, hotel, opts.refunded ?? 0) });
    case "checkout": {
      const number = g.invoice?.number ?? g.code;
      const pdf = await renderInvoicePdf(invoiceSourceForGroup(g), hotel);
      // The booker reviews the group stay through its first room.
      const link = g.reservations[0] ? await reviewUrl(g.reservations[0].id) : undefined;
      return sendEmail({ ...base, ...checkoutEmail(data, hotel, number, link), attachments: [{ filename: `${number}.pdf`, content: pdf, contentType: "application/pdf" }] });
    }
  }
}

/** Invites a departed guest to review their stay (one review per reservation). */
export async function sendReviewRequest(reservationId: string) {
  const [r, hotel] = await Promise.all([getReservation(reservationId), getSettings()]);
  if (!r?.guest.email) return false;
  return sendEmail({ to: r.guest.email, template: "review-request", reservationId, ...reviewRequestEmail(r.guest.firstName, r, hotel, await reviewUrl(r.id)) });
}

/** Sends a guest email about a single reservation. Returns false when the guest has no email or sending failed. */
export async function sendReservationEmail(reservationId: string, kind: ReservationEmailKind, opts: { refunded?: number } = {}) {
  const [r, hotel] = await Promise.all([getReservation(reservationId), getSettings()]);
  if (!r?.guest.email) return false;
  const data = emailData(r);
  const base = { to: r.guest.email, template: kind, reservationId };

  switch (kind) {
    case "confirmation":
      return sendEmail({ ...base, ...bookingConfirmationEmail(data, hotel) });
    case "pre-arrival":
      return sendEmail({ ...base, ...preArrivalEmail(data, hotel) });
    case "cancellation":
      return sendEmail({ ...base, ...cancellationEmail(data, hotel, opts.refunded ?? 0) });
    case "checkout": {
      const number = r.invoice?.number ?? r.code;
      const pdf = await renderInvoicePdf(invoiceSourceForReservation(r), hotel);
      return sendEmail({ ...base, ...checkoutEmail(data, hotel, number, await reviewUrl(r.id)), attachments: [{ filename: `${number}.pdf`, content: pdf, contentType: "application/pdf" }] });
    }
  }
}
