"use server";

import { assertPermission } from "@/lib/auth/dal";
import { findFreeRooms } from "@/lib/availability";
import { db } from "@/lib/db";
import { isISODate, parseISODate } from "@/lib/dates";
import { quoteBooking } from "@/lib/reservations";

export async function searchGuests(q: string) {
  await assertPermission("reservations");
  const term = q.trim();
  if (term.length < 2) return [];
  const parts = term.split(/\s+/);
  return db.guest.findMany({
    where: {
      AND: parts.map((p) => ({
        OR: [
          { firstName: { contains: p, mode: "insensitive" as const } },
          { lastName: { contains: p, mode: "insensitive" as const } },
          { email: { contains: p, mode: "insensitive" as const } },
          { phone: { contains: p } },
        ],
      })),
    },
    take: 8,
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, country: true, vip: true },
  });
}

export type LineInput = { roomTypeId: string; adults: number; children: number };

/** Free rooms per room type and the price of every line, for the staff booking form. */
export async function checkAvailability(args: { checkIn: string; checkOut: string; lines: LineInput[]; extras: string[] }) {
  await assertPermission("reservations");
  if (!isISODate(args.checkIn) || !isISODate(args.checkOut) || args.checkOut <= args.checkIn || args.lines.length === 0) return null;
  const checkIn = parseISODate(args.checkIn);
  const checkOut = parseISODate(args.checkOut);
  const typeIds = [...new Set(args.lines.map((l) => l.roomTypeId))];
  const [freeByType, quote] = await Promise.all([
    Promise.all(typeIds.map(async (id) => [id, await findFreeRooms(db, { roomTypeId: id, checkIn, checkOut })] as const)),
    quoteBooking({ checkIn, checkOut, rooms: args.lines, extraServiceIds: args.extras }),
  ]);
  const free = Object.fromEntries(freeByType.map(([id, rooms]) => [id, rooms.map((r) => ({ id: r.id, number: r.number, status: r.status }))]));
  const shortages = typeIds.filter((id) => args.lines.filter((l) => l.roomTypeId === id).length > (free[id]?.length ?? 0));
  return {
    free,
    shortages,
    lines: quote.rooms.map((r) => ({ total: r.total, roomTotal: r.roomTotal })),
    roomTotal: quote.rooms.reduce((s, r) => s + r.roomTotal, 0),
    cityTax: quote.rooms.reduce((s, r) => s + r.cityTax, 0),
    extrasTotal: quote.rooms.reduce((s, r) => s + r.extrasTotal, 0),
    total: quote.total,
    nights: quote.rooms[0]?.nightCount ?? 0,
  };
}
