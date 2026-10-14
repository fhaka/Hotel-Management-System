import { describe, expect, it } from "vitest";
import { distributeGuests, parseSelection, selectionParam } from "@/app/(site)/book/search-params";

describe("room selection", () => {
  it("parses multi-room selections and the legacy single room type", () => {
    expect(parseSelection({ rooms: "deluxe:2,standard:1" })).toEqual([{ slug: "deluxe", qty: 2 }, { slug: "standard", qty: 1 }]);
    expect(parseSelection({ roomType: "deluxe" })).toEqual([{ slug: "deluxe", qty: 1 }]);
    expect(parseSelection({ rooms: "bad slug!:2,deluxe:0" })).toEqual([]);
    expect(selectionParam([{ slug: "deluxe", qty: 2 }, { slug: "x", qty: 0 }])).toBe("deluxe:2");
  });
  it("spreads a party across rooms within each room's limits", () => {
    const rooms = [{ maxAdults: 2, maxChildren: 1 }, { maxAdults: 2, maxChildren: 2 }];
    expect(distributeGuests(rooms, 4, 2)).toEqual([{ adults: 2, children: 1 }, { adults: 2, children: 1 }]);
    expect(distributeGuests(rooms, 3, 0)).toEqual([{ adults: 2, children: 0 }, { adults: 1, children: 0 }]);
  });
  it("rejects parties that do not fit", () => {
    expect(distributeGuests([{ maxAdults: 2, maxChildren: 1 }], 3, 0)).toBeNull();
    expect(distributeGuests([{ maxAdults: 2, maxChildren: 0 }, { maxAdults: 2, maxChildren: 0 }], 1, 0)).toBeNull(); // every room needs an adult
  });
});
