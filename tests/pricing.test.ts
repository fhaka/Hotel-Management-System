import { describe, expect, it } from "vitest";
import { parseISODate } from "@/lib/dates";
import { extraQuantity, nightlyRate, quoteStay, vatPortion } from "@/lib/pricing";

const deluxe = { id: "deluxe", baseRate: 165, weekendRate: 185 };
const d = parseISODate;

describe("nightlyRate", () => {
  it("uses the weekday rate Sunday–Thursday", () => {
    expect(nightlyRate(deluxe, d("2026-10-28"), []).rate).toBe(165); // Wednesday
  });
  it("uses the weekend rate on Friday and Saturday nights", () => {
    expect(nightlyRate(deluxe, d("2026-10-30"), []).rate).toBe(185); // Friday
    expect(nightlyRate(deluxe, d("2026-10-31"), []).rate).toBe(185); // Saturday
    expect(nightlyRate(deluxe, d("2026-11-01"), []).rate).toBe(165); // Sunday
  });
  it("applies a hotel-wide season multiplier (end date exclusive)", () => {
    const seasons = [{ name: "Summer", startDate: d("2026-07-01"), endDate: d("2026-07-10"), multiplier: 1.3, roomTypeId: null }];
    expect(nightlyRate(deluxe, d("2026-07-01"), seasons)).toMatchObject({ rate: 214.5, label: "Summer" });
    expect(nightlyRate(deluxe, d("2026-07-10"), seasons).label).not.toBe("Summer");
  });
  it("prefers a room-type season over a hotel-wide one", () => {
    const seasons = [
      { name: "Hotel", startDate: d("2026-07-01"), endDate: d("2026-08-01"), multiplier: 1.3, roomTypeId: null },
      { name: "Deluxe promo", startDate: d("2026-07-01"), endDate: d("2026-08-01"), multiplier: 0.9, roomTypeId: "deluxe" },
    ];
    expect(nightlyRate(deluxe, d("2026-07-06"), seasons)).toMatchObject({ rate: 148.5, label: "Deluxe promo" });
  });
});

describe("quoteStay", () => {
  it("prices a 3-night stay with city tax and per-guest, per-night extras", () => {
    const q = quoteStay({
      roomType: deluxe,
      seasons: [],
      checkIn: d("2026-10-28"),
      checkOut: d("2026-10-31"),
      adults: 2,
      children: 1,
      extras: [{ id: "bf", name: "Breakfast", price: 18, perNight: true, perGuest: true }],
      cityTaxPerPersonNight: 1,
      vatRate: 20,
    });
    expect(q.nightCount).toBe(3);
    expect(q.roomTotal).toBe(515); // 165 + 165 + 185
    expect(q.cityTax).toBe(6); // adults only: 2 × 3
    expect(q.extras[0]).toMatchObject({ quantity: 9, amount: 162 }); // 3 guests × 3 nights
    expect(q.total).toBe(683);
    expect(q.vatIncluded).toBeCloseTo(vatPortion(677, 20), 2);
  });
});

describe("helpers", () => {
  it("derives extra quantities", () => {
    expect(extraQuantity({ perNight: false, perGuest: false }, 4, 3)).toBe(1);
    expect(extraQuantity({ perNight: true, perGuest: false }, 4, 3)).toBe(4);
    expect(extraQuantity({ perNight: false, perGuest: true }, 4, 3)).toBe(3);
  });
  it("extracts VAT from a gross amount", () => {
    expect(vatPortion(120, 20)).toBe(20);
    expect(vatPortion(100, 0)).toBe(0);
  });
});
