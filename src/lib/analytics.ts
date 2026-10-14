import "server-only";
import { db } from "@/lib/db";
import { nightsBetween, toISODate } from "@/lib/dates";
import { round2 } from "@/lib/format";

// Reservations that count as sold room nights (active or completed stays).
const SOLD = `('CONFIRMED','CHECKED_IN','CHECKED_OUT')`;

export async function sellableRooms() {
  return db.room.count({ where: { active: true } });
}

/** Rooms sold per night across a date range (inclusive start, exclusive end). */
export async function occupancySeries(from: Date, to: Date) {
  const rows = await db.$queryRawUnsafe<{ day: Date; sold: bigint }[]>(
    `SELECT d::date AS day,
            (SELECT count(*) FROM "Reservation" r
              WHERE r.status IN ${SOLD} AND r."checkIn" <= d::date AND r."checkOut" > d::date) AS sold
       FROM generate_series($1::date, $2::date - 1, interval '1 day') d
      ORDER BY d`,
    from,
    to,
  );
  const rooms = await sellableRooms();
  return rows.map((r) => ({ date: toISODate(r.day), sold: Number(r.sold), rooms, occupancy: rooms ? Number(r.sold) / rooms : 0 }));
}

/** Posted revenue per day, split into rooms and everything else. */
export async function revenueSeries(from: Date, to: Date) {
  const rows = await db.$queryRawUnsafe<{ day: Date; rooms: string | null; other: string | null }[]>(
    `SELECT d::date AS day,
            (SELECT sum(c.amount) FROM "FolioCharge" c WHERE c.date = d::date AND NOT c.voided AND c.type = 'ROOM') AS rooms,
            (SELECT sum(c.amount) FROM "FolioCharge" c WHERE c.date = d::date AND NOT c.voided AND c.type <> 'ROOM' AND c.type <> 'CITY_TAX') AS other
       FROM generate_series($1::date, $2::date - 1, interval '1 day') d
      ORDER BY d`,
    from,
    to,
  );
  return rows.map((r) => ({ date: toISODate(r.day), rooms: Number(r.rooms ?? 0), other: Number(r.other ?? 0) }));
}

export type Kpis = {
  occupancy: number;
  roomNightsSold: number;
  availableRoomNights: number;
  roomRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  adr: number;
  revpar: number;
};

export async function kpis(from: Date, to: Date): Promise<Kpis> {
  const [occ, rev] = await Promise.all([occupancySeries(from, to), revenueSeries(from, to)]);
  const roomNightsSold = occ.reduce((s, d) => s + d.sold, 0);
  const availableRoomNights = (occ[0]?.rooms ?? 0) * nightsBetween(from, to);
  const roomRevenue = round2(rev.reduce((s, d) => s + d.rooms, 0));
  const otherRevenue = round2(rev.reduce((s, d) => s + d.other, 0));
  return {
    occupancy: availableRoomNights ? roomNightsSold / availableRoomNights : 0,
    roomNightsSold,
    availableRoomNights,
    roomRevenue,
    otherRevenue,
    totalRevenue: round2(roomRevenue + otherRevenue),
    adr: roomNightsSold ? round2(roomRevenue / roomNightsSold) : 0,
    revpar: availableRoomNights ? round2(roomRevenue / availableRoomNights) : 0,
  };
}

/** Room revenue and nights by room type for stays overlapping the range. */
export async function byRoomType(from: Date, to: Date) {
  const rows = await db.$queryRawUnsafe<{ name: string; revenue: string | null; nights: bigint }[]>(
    `SELECT rt.name,
            sum(c.amount) AS revenue,
            count(c.id) AS nights
       FROM "RoomType" rt
       LEFT JOIN "Reservation" r ON r."roomTypeId" = rt.id
       LEFT JOIN "FolioCharge" c ON c."reservationId" = r.id AND c.type = 'ROOM' AND NOT c.voided AND c.date >= $1::date AND c.date < $2::date
      GROUP BY rt.name, rt."sortOrder"
      ORDER BY rt."sortOrder"`,
    from,
    to,
  );
  return rows.map((r) => ({ name: r.name, revenue: Number(r.revenue ?? 0), nights: Number(r.nights) }));
}

/** Bookings created in the range, grouped by channel. */
export async function bySource(from: Date, to: Date) {
  const rows = await db.reservation.groupBy({
    by: ["source"],
    where: { createdAt: { gte: from, lt: to } },
    _count: true,
  });
  return rows.map((r) => ({ source: r.source, count: r._count })).sort((a, b) => b.count - a.count);
}

/** Guests' countries for stays arriving in the range. */
export async function byCountry(from: Date, to: Date, limit = 8) {
  const rows = await db.$queryRawUnsafe<{ country: string | null; count: bigint }[]>(
    `SELECT g.country, count(*) AS count
       FROM "Reservation" r JOIN "Guest" g ON g.id = r."guestId"
      WHERE r."checkIn" >= $1::date AND r."checkIn" < $2::date AND r.status IN ${SOLD}
      GROUP BY g.country ORDER BY count DESC LIMIT ${Number(limit)}`,
    from,
    to,
  );
  return rows.map((r) => ({ country: r.country ?? "Unknown", count: Number(r.count) }));
}

/** Arrivals in the range: cancellations, no-shows, average stay and lead time. */
export async function bookingStats(from: Date, to: Date) {
  const [row] = await db.$queryRawUnsafe<{ total: bigint; cancelled: bigint; noshow: bigint; avg_los: string | null; avg_lead: string | null }[]>(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
            count(*) FILTER (WHERE status = 'NO_SHOW') AS noshow,
            avg("checkOut" - "checkIn") FILTER (WHERE status IN ${SOLD}) AS avg_los,
            avg("checkIn" - "createdAt"::date) FILTER (WHERE status IN ${SOLD}) AS avg_lead
       FROM "Reservation"
      WHERE "checkIn" >= $1::date AND "checkIn" < $2::date`,
    from,
    to,
  );
  const total = Number(row?.total ?? 0);
  return {
    total,
    cancellationRate: total ? Number(row!.cancelled) / total : 0,
    noShowRate: total ? Number(row!.noshow) / total : 0,
    avgLengthOfStay: Number(row?.avg_los ?? 0),
    avgLeadTime: Number(row?.avg_lead ?? 0),
  };
}
