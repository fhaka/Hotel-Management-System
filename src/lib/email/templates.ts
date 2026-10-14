import { formatLongDate } from "@/lib/dates";
import { formatMoney, pluralize } from "@/lib/format";
import type { HotelConfig } from "@/lib/settings";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]!);

function layout(hotel: HotelConfig, title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:#1c2233">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#0f1a2e;padding:28px 36px;text-align:center">
      <div style="font-family:Georgia,serif;color:#c9a96e;font-size:18px">&#9813;</div>
      <div style="font-family:Georgia,serif;color:#ffffff;font-size:24px;letter-spacing:3px;margin-top:4px">HOTEL IMPERIAL</div>
      <div style="color:#c9a96e;font-size:11px;letter-spacing:3px;margin-top:4px">${esc(hotel.city.toUpperCase())}</div>
    </td></tr>
    <tr><td style="padding:36px">
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;margin:0 0 16px">${title}</h1>
      ${body}
    </td></tr>
    <tr><td style="background:#faf8f3;padding:20px 36px;font-size:12px;color:#6b7280;text-align:center;line-height:1.6">
      ${esc(hotel.name)} · ${esc(hotel.address)}, ${esc(hotel.city)}, ${esc(hotel.country)}<br>
      ${esc(hotel.phone)} · <a href="mailto:${esc(hotel.email)}" style="color:#9a7b45">${esc(hotel.email)}</a>
    </td></tr>
  </table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:28px 0 8px"><a href="${href}" style="background:#0f1a2e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;display:inline-block">${esc(label)}</a></p>`;
}

function rows(items: [string, string][]) {
  const cells = items
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #ece7dc;color:#6b7280">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #ece7dc;text-align:right;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece7dc;margin:20px 0;font-size:14px">${cells}</table>`;
}

const p = (s: string) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${s}</p>`;

export type EmailReservation = {
  code: string;
  guestFirstName: string;
  guestEmail: string;
  roomTypeName: string;
  /** Set for multi-room bookings: one line per room. */
  rooms?: string[];
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  total: number;
  paid: number;
  balance: number;
};

function manageLink(r: EmailReservation) {
  return `${appUrl()}/manage-booking?code=${r.code}`;
}

function stayRows(r: EmailReservation, hotel: HotelConfig) {
  const guests = `${pluralize(r.adults, "adult")}${r.children ? `, ${pluralize(r.children, "child", "children")}` : ""}`;
  return rows([
    ["Confirmation number", r.code],
    ...(r.rooms && r.rooms.length > 1
      ? r.rooms.map((room, i): [string, string] => [`Room ${i + 1}`, room])
      : [["Room", r.roomTypeName] as [string, string]]),
    ["Check-in", `${formatLongDate(r.checkIn)} from ${hotel.checkInTime}`],
    ["Check-out", `${formatLongDate(r.checkOut)} until ${hotel.checkOutTime}`],
    ["Guests", guests],
    ["Length of stay", pluralize(r.nights, "night")],
    ["Total", formatMoney(r.total)],
    ["Paid", formatMoney(r.paid)],
    ["Balance due at hotel", formatMoney(Math.max(r.balance, 0))],
  ]);
}

export function bookingConfirmationEmail(r: EmailReservation, hotel: HotelConfig) {
  return {
    subject: `Your reservation is confirmed — ${r.code}`,
    html: layout(
      hotel,
      `We look forward to welcoming you, ${esc(r.guestFirstName)}`,
      p("Thank you for choosing Hotel Imperial. Your reservation is confirmed and the details are below.") +
        stayRows(r, hotel) +
        p(`Free cancellation is available up to ${hotel.freeCancellationHours} hours before arrival.`) +
        button(manageLink(r), "Manage your booking"),
    ),
  };
}

export function cancellationEmail(r: EmailReservation, hotel: HotelConfig, refunded: number) {
  return {
    subject: `Reservation cancelled — ${r.code}`,
    html: layout(
      hotel,
      "Your reservation has been cancelled",
      p(`Dear ${esc(r.guestFirstName)}, your reservation <strong>${r.code}</strong> for ${formatLongDate(r.checkIn)} has been cancelled.`) +
        (refunded > 0 ? p(`A refund of <strong>${formatMoney(refunded)}</strong> has been issued to your original payment method.`) : "") +
        p("We hope to welcome you another time.") +
        button(`${appUrl()}/book`, "Plan a new stay"),
    ),
  };
}

export function preArrivalEmail(r: EmailReservation, hotel: HotelConfig) {
  return {
    subject: `See you soon — your stay begins ${formatLongDate(r.checkIn)}`,
    html: layout(
      hotel,
      `Your stay is almost here, ${esc(r.guestFirstName)}`,
      p(
        `We're preparing your ${esc(r.roomTypeName)}. Check-in opens at ${hotel.checkInTime}; reply to this email with your arrival time or any special requests.`,
      ) +
        stayRows(r, hotel) +
        button(manageLink(r), "View your booking"),
    ),
  };
}

export function checkoutEmail(r: EmailReservation, hotel: HotelConfig, invoiceNumber: string) {
  return {
    subject: `Thank you for staying with us — invoice ${invoiceNumber}`,
    html: layout(
      hotel,
      `Thank you, ${esc(r.guestFirstName)}`,
      p("It was a pleasure hosting you at Hotel Imperial. Your invoice is attached to this email.") +
        rows([
          ["Invoice", invoiceNumber],
          ["Stay", `${formatLongDate(r.checkIn)} – ${formatLongDate(r.checkOut)}`],
          ["Total", formatMoney(r.total)],
        ]) +
        p("We would love to hear about your stay, and we hope to see you again soon."),
    ),
  };
}

export function welcomeEmail(name: string, hotel: HotelConfig) {
  return {
    subject: "Welcome to Hotel Imperial",
    html: layout(
      hotel,
      `Welcome, ${esc(name)}`,
      p("Your Hotel Imperial account is ready. Use it to book faster, manage reservations and download your invoices.") +
        button(`${appUrl()}/account`, "Go to my account"),
    ),
  };
}

export function contactReceiptEmail(name: string, subject: string, hotel: HotelConfig) {
  return {
    subject: `We received your message: ${subject}`,
    html: layout(
      hotel,
      `Thank you, ${esc(name)}`,
      p("Our guest relations team has received your message and will reply within one business day."),
    ),
  };
}
