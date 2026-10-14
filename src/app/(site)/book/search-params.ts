import { addDaysISO, isISODate, nightsBetween, parseISODate, todayISO } from "@/lib/dates";

export type StaySearch = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomType?: string;
  error?: string;
  provided: boolean;
};

const clampInt = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export function parseStaySearch(sp: Record<string, string | string[] | undefined>): StaySearch {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const today = todayISO();
  const provided = isISODate(get("checkIn")) && isISODate(get("checkOut"));
  let checkIn = provided ? get("checkIn")! : addDaysISO(today, 7);
  let checkOut = provided ? get("checkOut")! : addDaysISO(today, 10);
  let error: string | undefined;
  if (checkIn < today) {
    error = "Check-in cannot be in the past — we've moved your dates to today.";
    const nights = Math.max(1, nightsBetween(parseISODate(checkIn), parseISODate(checkOut)));
    checkIn = today;
    checkOut = addDaysISO(today, nights);
  }
  if (checkOut <= checkIn) {
    error = "Check-out must be after check-in.";
    checkOut = addDaysISO(checkIn, 1);
  }
  if (nightsBetween(parseISODate(checkIn), parseISODate(checkOut)) > 30) {
    error = "Online bookings are limited to 30 nights. Please contact us for longer stays.";
    checkOut = addDaysISO(checkIn, 30);
  }
  return {
    checkIn,
    checkOut,
    adults: clampInt(get("adults"), 1, 16, 2),
    children: clampInt(get("children"), 0, 8, 0),
    roomType: get("roomType"),
    error,
    provided,
  };
}

export function searchQuery(s: Pick<StaySearch, "checkIn" | "checkOut" | "adults" | "children">, extra: Record<string, string> = {}) {
  return new URLSearchParams({ checkIn: s.checkIn, checkOut: s.checkOut, adults: String(s.adults), children: String(s.children), ...extra }).toString();
}

export type RoomSelection = { slug: string; qty: number }[];

/** Parses `rooms=deluxe:2,standard:1` (or the legacy single `roomType=slug`). */
export function parseSelection(sp: Record<string, string | string[] | undefined>): RoomSelection {
  const raw = typeof sp.rooms === "string" ? sp.rooms : "";
  const parsed = raw
    .split(",")
    .map((part) => {
      const [slug, qty] = part.split(":");
      return { slug: (slug ?? "").trim(), qty: Math.min(8, Math.max(0, Math.floor(Number(qty ?? 1)) || 0)) };
    })
    .filter((s) => /^[a-z0-9-]+$/.test(s.slug) && s.qty > 0);
  if (parsed.length) return parsed;
  return typeof sp.roomType === "string" && /^[a-z0-9-]+$/.test(sp.roomType) ? [{ slug: sp.roomType, qty: 1 }] : [];
}

export const selectionParam = (sel: RoomSelection) => sel.filter((s) => s.qty > 0).map((s) => `${s.slug}:${s.qty}`).join(",");

/**
 * Spreads the party over the selected rooms: one adult per room first, then the remaining adults and
 * children into rooms with spare capacity. Returns null when the party does not fit.
 */
export function distributeGuests(rooms: { maxAdults: number; maxChildren: number }[], adults: number, children: number) {
  if (rooms.length === 0 || adults < rooms.length) return null;
  const out = rooms.map(() => ({ adults: 1, children: 0 }));
  let a = adults - rooms.length;
  let c = children;
  for (let pass = 0; pass < 10 && (a > 0 || c > 0); pass++) {
    rooms.forEach((room, i) => {
      if (a > 0 && out[i]!.adults < room.maxAdults) {
        out[i]!.adults++;
        a--;
      } else if (c > 0 && out[i]!.children < room.maxChildren) {
        out[i]!.children++;
        c--;
      }
    });
  }
  return a > 0 || c > 0 ? null : out;
}
