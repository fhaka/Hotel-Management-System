// Stay dates are calendar dates without time. They are stored as Postgres DATE and handled in JS as
// UTC-midnight Date objects or "YYYY-MM-DD" strings. "Today" is evaluated in the hotel's time zone.

export const HOTEL_TIME_ZONE = "Europe/Tirane";
const DAY_MS = 86_400_000;

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function today(): Date {
  return parseISODate(todayISO());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addDaysISO(value: string, days: number): string {
  return toISODate(addDays(parseISODate(value), days));
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
}

export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) nights.push(d);
  return nights;
}

/** Friday and Saturday nights are weekend nights. */
export function isWeekendNight(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 5 || day === 6;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: HOTEL_TIME_ZONE,
});

/** Formats a stay date (UTC midnight). */
export const formatDate = (d: Date | string) => dateFmt.format(typeof d === "string" ? parseISODate(d) : d);
export const formatShortDate = (d: Date | string) => shortFmt.format(typeof d === "string" ? parseISODate(d) : d);
export const formatLongDate = (d: Date | string) => longFmt.format(typeof d === "string" ? parseISODate(d) : d);
export const formatWeekday = (d: Date) => weekdayFmt.format(d);
/** Formats a timestamp in hotel local time. */
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);
