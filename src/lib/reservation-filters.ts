import { isISODate, parseISODate } from "@/lib/dates";
import type { Prisma, ReservationStatus } from "@/generated/prisma/client";

const STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];

export type ReservationFilters = { q?: string; status?: string; from?: string; to?: string; dateField?: string };

export function reservationWhere(sp: ReservationFilters): Prisma.ReservationWhereInput {
  const where: Prisma.ReservationWhereInput = {};
  const q = sp.q?.trim();
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { guest: { firstName: { contains: q, mode: "insensitive" } } },
      { guest: { lastName: { contains: q, mode: "insensitive" } } },
      { guest: { email: { contains: q, mode: "insensitive" } } },
      { room: { number: q } },
    ];
  }
  if (sp.status && STATUSES.includes(sp.status)) where.status = sp.status as ReservationStatus;
  const field = sp.dateField === "checkOut" ? "checkOut" : sp.dateField === "createdAt" ? "createdAt" : "checkIn";
  const range: Prisma.DateTimeFilter = {};
  if (isISODate(sp.from)) range.gte = parseISODate(sp.from);
  if (isISODate(sp.to)) range.lte = field === "createdAt" ? new Date(parseISODate(sp.to).getTime() + 86_399_999) : parseISODate(sp.to);
  if (range.gte || range.lte) where[field] = range;
  return where;
}

