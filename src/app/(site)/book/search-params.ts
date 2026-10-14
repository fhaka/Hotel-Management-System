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
    adults: clampInt(get("adults"), 1, 6, 2),
    children: clampInt(get("children"), 0, 4, 0),
    roomType: get("roomType"),
    error,
    provided,
  };
}

export function searchQuery(s: Pick<StaySearch, "checkIn" | "checkOut" | "adults" | "children">, extra: Record<string, string> = {}) {
  return new URLSearchParams({ checkIn: s.checkIn, checkOut: s.checkOut, adults: String(s.adults), children: String(s.children), ...extra }).toString();
}
