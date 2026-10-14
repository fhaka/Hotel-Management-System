import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { nightsBetween, toISODate, todayISO } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { reservationWhere } from "@/lib/reservation-filters";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reservations")) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await db.reservation.findMany({
    where: reservationWhere(sp),
    include: { guest: true, room: true, roomType: true, charges: true, payments: true },
    orderBy: { checkIn: "asc" },
    take: 10_000,
  });
  const csv = toCsv(
    ["Confirmation", "Status", "Guest", "Email", "Phone", "Country", "Room type", "Room", "Check-in", "Check-out", "Nights", "Adults", "Children", "Channel", "Booked at", "Total", "Paid", "Balance"],
    rows.map((r) => {
      const f = summarizeFolio(r);
      return [r.code, r.status, `${r.guest.firstName} ${r.guest.lastName}`, r.guest.email, r.guest.phone, r.guest.country, r.roomType.name, r.room?.number, toISODate(r.checkIn), toISODate(r.checkOut), nightsBetween(r.checkIn, r.checkOut), r.adults, r.children, r.source, r.createdAt, f.total.toFixed(2), (f.paid - f.refunded).toFixed(2), f.balance.toFixed(2)];
    }),
  );
  return csvResponse(`reservations-${todayISO()}.csv`, csv);
}
