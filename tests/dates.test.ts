import { describe, expect, it } from "vitest";
import { addDaysISO, eachNight, isISODate, isWeekendNight, nightsBetween, parseISODate } from "@/lib/dates";

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("28/02/2026")).toBe(false);
  });
  it("counts nights across month and DST boundaries", () => {
    expect(nightsBetween(parseISODate("2026-10-24"), parseISODate("2026-10-27"))).toBe(3); // EU DST ends 25 Oct
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(eachNight(parseISODate("2026-03-28"), parseISODate("2026-03-31"))).toHaveLength(3);
  });
  it("treats Friday and Saturday as weekend nights", () => {
    expect(isWeekendNight(parseISODate("2026-10-16"))).toBe(true);
    expect(isWeekendNight(parseISODate("2026-10-18"))).toBe(false);
  });
});
