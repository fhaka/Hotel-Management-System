// Booking rules (stay restrictions) and promo codes. Pure functions shared by the server and the browser.
import { addDays, eachNight, formatDate, formatWeekday, nightsBetween } from "@/lib/dates";
import { formatMoney, pluralize, round2 } from "@/lib/format";

// ─── Stay restrictions ─────────────────────────────────────────────────────

export type RestrictionLike = {
  name: string;
  startDate: Date;
  endDate: Date;
  roomTypeId: string | null;
  weekdays: number[];
  minNights: number | null;
  closedToArrival: boolean;
  stopSell: boolean;
  active?: boolean;
};

const inRange = (d: Date, r: { startDate: Date; endDate: Date }) => d >= r.startDate && d < r.endDate;

/**
 * Why a stay cannot be booked online under the active rules, or null when it can.
 * Stop-sell applies to every night of the stay; closed-to-arrival and minimum stay apply to the arrival date.
 */
export function restrictionViolation(stay: { checkIn: Date; checkOut: Date; roomTypeId: string }, rules: RestrictionLike[]): string | null {
  const relevant = rules.filter((r) => r.active !== false && (!r.roomTypeId || r.roomTypeId === stay.roomTypeId));
  const nights = eachNight(stay.checkIn, stay.checkOut);
  const closed = relevant.find((r) => r.stopSell && nights.some((n) => inRange(n, r)));
  if (closed) return `Not available on these dates (${closed.name}).`;

  const arrivalRules = relevant.filter((r) => inRange(stay.checkIn, r) && (r.weekdays.length === 0 || r.weekdays.includes(stay.checkIn.getUTCDay())));
  const cta = arrivalRules.find((r) => r.closedToArrival);
  if (cta) return `Arrivals are not possible on ${formatWeekday(stay.checkIn)} ${formatDate(stay.checkIn)} (${cta.name}).`;

  const minStay = Math.max(0, ...arrivalRules.map((r) => r.minNights ?? 0));
  if (minStay > nightsBetween(stay.checkIn, stay.checkOut)) {
    return `A minimum stay of ${pluralize(minStay, "night")} applies for arrival on ${formatWeekday(stay.checkIn)} ${formatDate(stay.checkIn)}.`;
  }
  return null;
}

/** Plain-language summary of a rule, for staff screens. */
export function describeRestriction(r: RestrictionLike) {
  const days = r.weekdays.length && r.weekdays.length < 7 ? ` on ${r.weekdays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join("/")} arrivals` : "";
  const parts: string[] = [];
  if (r.stopSell) parts.push("closed for sale");
  if (r.closedToArrival) parts.push(`no arrivals${days}`);
  if (r.minNights) parts.push(`minimum ${pluralize(r.minNights, "night")}${days}`);
  return parts.join(" · ") || "no effect";
}

export function lastNight(r: { endDate: Date }) {
  return addDays(r.endDate, -1);
}

// ─── Promo codes ───────────────────────────────────────────────────────────

export type PromoLike = {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED_PER_NIGHT";
  value: number;
  validFrom: Date | null;
  validTo: Date | null;
  stayFrom: Date | null;
  stayTo: Date | null;
  minNights: number;
  roomTypeIds: string[];
  maxUses: number | null;
  usedCount: number;
  active: boolean;
};

export const normalizePromoCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export function promoAppliesTo(p: Pick<PromoLike, "roomTypeIds">, roomTypeId: string) {
  return p.roomTypeIds.length === 0 || p.roomTypeIds.includes(roomTypeId);
}

/** Why a promo code cannot be used for this booking, or null when it can. */
export function promoProblem(p: PromoLike, b: { today: Date; checkIn: Date; checkOut: Date; roomTypeIds: string[] }): string | null {
  if (!p.active) return "This promo code is no longer active.";
  if (p.maxUses != null && p.usedCount >= p.maxUses) return "This promo code has been fully redeemed.";
  if (p.validFrom && b.today < p.validFrom) return `This promo code can be used from ${formatDate(p.validFrom)}.`;
  if (p.validTo && b.today > p.validTo) return "This promo code has expired.";
  if ((p.stayFrom && b.checkIn < p.stayFrom) || (p.stayTo && b.checkIn > p.stayTo)) {
    const from = p.stayFrom ? formatDate(p.stayFrom) : "now";
    return p.stayTo ? `Valid for arrivals between ${from} and ${formatDate(p.stayTo)}.` : `Valid for arrivals from ${from}.`;
  }
  if (nightsBetween(b.checkIn, b.checkOut) < p.minNights) return `Valid for stays of at least ${pluralize(p.minNights, "night")}.`;
  if (!b.roomTypeIds.some((id) => promoAppliesTo(p, id))) return "This promo code is not valid for the selected rooms.";
  return null;
}

/** Discount (a positive amount) on one room's rate. */
export function promoDiscount(p: Pick<PromoLike, "type" | "value">, roomTotal: number, nights: number) {
  const raw = p.type === "PERCENT" ? (roomTotal * p.value) / 100 : p.value * nights;
  return round2(Math.min(roomTotal, Math.max(0, raw)));
}

export function promoLabel(p: Pick<PromoLike, "type" | "value">) {
  return p.type === "PERCENT" ? `${p.value}% off room rates` : `${formatMoney(p.value)} off per night`;
}
