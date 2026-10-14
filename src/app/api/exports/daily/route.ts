import { occupancySeries, revenueSeries } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { addDays, isISODate, parseISODate } from "@/lib/dates";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reports")) return new Response("Forbidden", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const fromISO = sp.get("from");
  const toISO = sp.get("to");
  if (!isISODate(fromISO) || !isISODate(toISO) || toISO < fromISO) return new Response("Invalid range", { status: 400 });
  const from = parseISODate(fromISO);
  const to = addDays(parseISODate(toISO), 1);
  const [occ, rev] = await Promise.all([occupancySeries(from, to), revenueSeries(from, to)]);
  const csv = toCsv(
    ["Date", "Rooms available", "Rooms sold", "Occupancy %", "Room revenue", "Other revenue", "ADR", "RevPAR"],
    occ.map((o, i) => {
      const r = rev[i]!;
      return [o.date, o.rooms, o.sold, (o.occupancy * 100).toFixed(1), r.rooms.toFixed(2), r.other.toFixed(2), (o.sold ? r.rooms / o.sold : 0).toFixed(2), (o.rooms ? r.rooms / o.rooms : 0).toFixed(2)];
    }),
  );
  return csvResponse(`daily-statistics-${fromISO}-to-${toISO}.csv`, csv);
}
