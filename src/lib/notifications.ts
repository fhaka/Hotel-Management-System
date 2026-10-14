import "server-only";
import { sendEmail } from "@/lib/email/mailer";
import { bookingConfirmationEmail, cancellationEmail, checkoutEmail, preArrivalEmail } from "@/lib/email/templates";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { emailData, getReservation } from "@/lib/reservations";
import { getSettings } from "@/lib/settings";

export type ReservationEmailKind = "confirmation" | "pre-arrival" | "cancellation" | "checkout";

/** Sends a guest email about a reservation. Returns false when the guest has no email or sending failed. */
export async function sendReservationEmail(reservationId: string, kind: ReservationEmailKind, opts: { refunded?: number } = {}) {
  const [r, hotel] = await Promise.all([getReservation(reservationId), getSettings()]);
  if (!r?.guest.email) return false;
  const data = emailData(r);

  switch (kind) {
    case "confirmation":
      return sendEmail({ to: r.guest.email, template: kind, reservationId, ...bookingConfirmationEmail(data, hotel) });
    case "pre-arrival":
      return sendEmail({ to: r.guest.email, template: kind, reservationId, ...preArrivalEmail(data, hotel) });
    case "cancellation":
      return sendEmail({ to: r.guest.email, template: kind, reservationId, ...cancellationEmail(data, hotel, opts.refunded ?? 0) });
    case "checkout": {
      const number = r.invoice?.number ?? r.code;
      const pdf = await renderInvoicePdf(r, hotel);
      return sendEmail({
        to: r.guest.email,
        template: kind,
        reservationId,
        ...checkoutEmail(data, hotel, number),
        attachments: [{ filename: `${number}.pdf`, content: pdf, contentType: "application/pdf" }],
      });
    }
  }
}
