import { describe, expect, it } from "vitest";
import { normalizePromoCode, promoDiscount, promoProblem, restrictionViolation, type PromoLike, type RestrictionLike } from "@/lib/booking-rules";
import { parseISODate as d } from "@/lib/dates";

const rule = (r: Partial<RestrictionLike>): RestrictionLike => ({
  name: "Rule",
  startDate: d("2026-12-01"),
  endDate: d("2027-01-01"),
  roomTypeId: null,
  weekdays: [],
  minNights: null,
  closedToArrival: false,
  stopSell: false,
  ...r,
});
const stay = (checkIn: string, checkOut: string, roomTypeId = "deluxe") => ({ checkIn: d(checkIn), checkOut: d(checkOut), roomTypeId });

describe("restrictionViolation", () => {
  it("blocks any stay touching a stop-sell night", () => {
    const rules = [rule({ name: "Private event", startDate: d("2026-12-31"), endDate: d("2027-01-02"), stopSell: true })];
    expect(restrictionViolation(stay("2026-12-29", "2027-01-01"), rules)).toMatch(/Not available.*Private event/);
    expect(restrictionViolation(stay("2026-12-28", "2026-12-31"), rules)).toBeNull(); // departs on the closed day
  });
  it("enforces minimum stay on matching arrival weekdays only", () => {
    const rules = [rule({ minNights: 2, weekdays: [5, 6] })]; // Fri/Sat arrivals
    expect(restrictionViolation(stay("2026-12-04", "2026-12-05"), rules)).toMatch(/minimum stay of 2 nights/); // Friday
    expect(restrictionViolation(stay("2026-12-04", "2026-12-06"), rules)).toBeNull();
    expect(restrictionViolation(stay("2026-12-03", "2026-12-04"), rules)).toBeNull(); // Thursday
  });
  it("uses the strictest minimum stay and honours closed-to-arrival", () => {
    const rules = [rule({ minNights: 2 }), rule({ minNights: 4 }), rule({ name: "Christmas Eve", startDate: d("2026-12-24"), endDate: d("2026-12-25"), closedToArrival: true })];
    expect(restrictionViolation(stay("2026-12-10", "2026-12-13"), rules)).toMatch(/4 nights/);
    expect(restrictionViolation(stay("2026-12-24", "2026-12-30"), rules)).toMatch(/Arrivals are not possible/);
  });
  it("ignores rules for other room types and inactive rules", () => {
    const rules = [rule({ roomTypeId: "suite", stopSell: true }), rule({ stopSell: true, active: false })];
    expect(restrictionViolation(stay("2026-12-10", "2026-12-11"), rules)).toBeNull();
  });
});

const promo = (p: Partial<PromoLike>): PromoLike => ({
  code: "TEST",
  description: "",
  type: "PERCENT",
  value: 10,
  validFrom: null,
  validTo: null,
  stayFrom: null,
  stayTo: null,
  minNights: 1,
  roomTypeIds: [],
  maxUses: null,
  usedCount: 0,
  active: true,
  ...p,
});
const booking = { today: d("2026-10-15"), checkIn: d("2026-11-10"), checkOut: d("2026-11-13"), roomTypeIds: ["deluxe"] };

describe("promo codes", () => {
  it("accepts a valid code and computes discounts", () => {
    expect(promoProblem(promo({}), booking)).toBeNull();
    expect(promoDiscount({ type: "PERCENT", value: 10 }, 495, 3)).toBe(49.5);
    expect(promoDiscount({ type: "FIXED_PER_NIGHT", value: 40 }, 495, 3)).toBe(120);
    expect(promoDiscount({ type: "FIXED_PER_NIGHT", value: 400 }, 495, 3)).toBe(495); // never more than the rate
  });
  it("rejects inactive, exhausted, expired and not-yet-valid codes", () => {
    expect(promoProblem(promo({ active: false }), booking)).toMatch(/no longer active/);
    expect(promoProblem(promo({ maxUses: 5, usedCount: 5 }), booking)).toMatch(/fully redeemed/);
    expect(promoProblem(promo({ validTo: d("2026-10-01") }), booking)).toMatch(/expired/);
    expect(promoProblem(promo({ validFrom: d("2026-11-01") }), booking)).toMatch(/can be used from/);
  });
  it("checks arrival window, minimum nights and room types", () => {
    expect(promoProblem(promo({ stayFrom: d("2027-06-01"), stayTo: d("2027-08-31") }), booking)).toMatch(/arrivals between/);
    expect(promoProblem(promo({ minNights: 4 }), booking)).toMatch(/at least 4 nights/);
    expect(promoProblem(promo({ roomTypeIds: ["suite"] }), booking)).toMatch(/not valid for the selected rooms/);
    expect(promoProblem(promo({ roomTypeIds: ["suite"] }), { ...booking, roomTypeIds: ["deluxe", "suite"] })).toBeNull();
  });
  it("normalises codes", () => {
    expect(normalizePromoCode(" summer 10 ")).toBe("SUMMER10");
  });
});
