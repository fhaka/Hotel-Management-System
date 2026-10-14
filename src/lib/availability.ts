import "server-only";
import { db } from "@/lib/db";
import type { Prisma, ReservationStatus } from "@/generated/prisma/client";

/** Statuses that occupy a room for their date range. */
export const ACTIVE_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

type Client = Prisma.TransactionClient | typeof db;

export function overlapFilter(checkIn: Date, checkOut: Date, excludeReservationId?: string): Prisma.ReservationWhereInput {
  return {
    status: { in: ACTIVE_STATUSES },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
    ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
  };
}

/** Physical rooms of a type that are free for the whole stay, cleanest first. */
export async function findFreeRooms(
  client: Client,
  args: { roomTypeId?: string; checkIn: Date; checkOut: Date; excludeReservationId?: string },
) {
  const rooms = await client.room.findMany({
    where: {
      ...(args.roomTypeId ? { roomTypeId: args.roomTypeId } : {}),
      active: true,
      status: { not: "OUT_OF_ORDER" },
      reservations: { none: overlapFilter(args.checkIn, args.checkOut, args.excludeReservationId) },
    },
    include: { roomType: { select: { id: true, name: true } } },
    orderBy: { number: "asc" },
  });
  const rank = { INSPECTED: 0, CLEAN: 1, DIRTY: 2, OUT_OF_ORDER: 3 } as const;
  return rooms.sort((a, b) => rank[a.status] - rank[b.status] || a.number.localeCompare(b.number, undefined, { numeric: true }));
}

export async function isRoomFree(client: Client, roomId: string, checkIn: Date, checkOut: Date, excludeReservationId?: string) {
  const clash = await client.reservation.findFirst({
    where: { roomId, ...overlapFilter(checkIn, checkOut, excludeReservationId) },
    select: { id: true },
  });
  return !clash;
}

/** Free room count per room type for a date range. */
export async function availabilityByType(checkIn: Date, checkOut: Date) {
  const rooms = await findFreeRooms(db, { checkIn, checkOut });
  const counts = new Map<string, number>();
  for (const room of rooms) counts.set(room.roomTypeId, (counts.get(room.roomTypeId) ?? 0) + 1);
  return counts;
}
