"use server";

import { assertPermission } from "@/lib/auth/dal";
import { findFreeRooms } from "@/lib/availability";
import { db } from "@/lib/db";
import { isISODate, parseISODate } from "@/lib/dates";
import { quoteReservation } from "@/lib/reservations";

export async function searchGuests(q: string) {
  await assertPermission("reservations");
  const term = q.trim();
  if (term.length < 2) return [];
  const parts = term.split(/\s+/);
  const guests = await db.guest.findMany({
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
  return guests;
}

export async function checkAvailability(args: { roomTypeId: string; checkIn: string; checkOut: string; adults: number; children: number; extras: string[] }) {
  await assertPermission("reservations");
  if (!args.roomTypeId || !isISODate(args.checkIn) || !isISODate(args.checkOut) || args.checkOut <= args.checkIn) return null;
  const checkIn = parseISODate(args.checkIn);
  const checkOut = parseISODate(args.checkOut);
  const [rooms, { quote }] = await Promise.all([
    findFreeRooms(db, { roomTypeId: args.roomTypeId, checkIn, checkOut }),
    quoteReservation({ roomTypeId: args.roomTypeId, checkIn, checkOut, adults: args.adults, children: args.children, extraServiceIds: args.extras }),
  ]);
  return {
    rooms: rooms.map((r) => ({ id: r.id, number: r.number, status: r.status })),
    total: quote.total,
    roomTotal: quote.roomTotal,
    cityTax: quote.cityTax,
    extrasTotal: quote.extrasTotal,
    nights: quote.nightCount,
  };
}
