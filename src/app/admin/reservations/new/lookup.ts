"use server";

import { assertPermission } from "@/lib/auth/dal";
import { findFreeRooms } from "@/lib/availability";
import { db } from "@/lib/db";
import { isISODate, parseISODate } from "@/lib/dates";
import { BookingError, loadRestrictions, quoteBooking } from "@/lib/reservations";
import { restrictionViolation } from "@/lib/booking-rules";

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
export async function checkAvailability(args: { checkIn: string; checkOut: string; lines: LineInput[]; extras: string[]; promoCode?: string }) {
  await assertPermission("reservations");
  if (!isISODate(args.checkIn) || !isISODate(args.checkOut) || args.checkOut <= args.checkIn || args.lines.length === 0) return null;
  const checkIn = parseISODate(args.checkIn);
  const checkOut = parseISODate(args.checkOut);
  const typeIds = [...new Set(args.lines.map((l) => l.roomTypeId))];
  const base = { checkIn, checkOut, rooms: args.lines, extraServiceIds: args.extras };
  let promoError: string | null = null;
  const priced = async () => {
    if (!args.promoCode?.trim()) return quoteBooking(base);
    try {
      return await quoteBooking({ ...base, promoCode: args.promoCode });
    } catch (e) {
      if (!(e instanceof BookingError)) throw e;
      promoError = e.message;
      return quoteBooking(base);
    }
  };
  const [freeByType, quote, rules] = await Promise.all([
    Promise.all(typeIds.map(async (id) => [id, await findFreeRooms(db, { roomTypeId: id, checkIn, checkOut })] as const)),
    priced(),
    loadRestrictions(checkIn, checkOut),
  ]);
  // Booking rules bind online bookings only; staff see them as warnings.
  const warnings = [...new Set(typeIds.map((id) => restrictionViolation({ checkIn, checkOut, roomTypeId: id }, rules)).filter((w): w is string => !!w))];
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
    discount: quote.discount,
    promo: quote.promo,
    promoError,
    warnings,
    nights: quote.rooms[0]?.nightCount ?? 0,
  };
}
