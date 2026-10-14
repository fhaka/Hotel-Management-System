import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ACTIVE_STATUSES, findFreeRooms, isRoomFree } from "@/lib/availability";
import { addDays, nightsBetween, today, toISODate } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { round2, toNumber, formatMoney } from "@/lib/format";
import { quoteStay, type Quote } from "@/lib/pricing";
import { getSettings, type HotelConfig } from "@/lib/settings";
import { getPaymentProvider, type CardDetails } from "@/lib/payments";
import { randomCode } from "@/lib/utils";
import type { BookingSource, PaymentMethod, Prisma } from "@/generated/prisma/client";

/** A failure whose message is safe to show to the user. */
export class BookingError extends Error {}

type Tx = Prisma.TransactionClient;

export const MAX_NIGHTS = 30;

function isOverlapError(e: unknown) {
  const text = e instanceof Error ? `${e.message} ${JSON.stringify(e)}` : JSON.stringify(e);
  return text.includes("23P01") || text.includes("Reservation_no_overlap");
}

async function newReservationCode(tx: Tx) {
  for (;;) {
    const code = `HI${randomCode(6)}`;
    if (!(await tx.reservation.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
}

// ─── Quotes ────────────────────────────────────────────────────────────────

export type StayRequest = {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  extraServiceIds?: string[];
};

export async function validateStay(req: StayRequest, opts: { allowPast?: boolean } = {}) {
  const roomType = await db.roomType.findUnique({ where: { id: req.roomTypeId } });
  if (!roomType || !roomType.active) throw new BookingError("This room type is not available.");
  const nights = nightsBetween(req.checkIn, req.checkOut);
  if (nights < 1) throw new BookingError("Check-out must be after check-in.");
  if (nights > MAX_NIGHTS) throw new BookingError(`Stays are limited to ${MAX_NIGHTS} nights online. Please contact us for longer stays.`);
  if (!opts.allowPast && req.checkIn < today()) throw new BookingError("Check-in cannot be in the past.");
  if (req.adults < 1) throw new BookingError("At least one adult is required.");
  if (req.adults > roomType.maxAdults || req.children > roomType.maxChildren) {
    throw new BookingError(`The ${roomType.name} accommodates up to ${roomType.maxAdults} adults and ${roomType.maxChildren} children.`);
  }
  return roomType;
}

export async function quoteReservation(req: StayRequest): Promise<{ quote: Quote; settings: HotelConfig }> {
  const [roomType, seasons, settings, extras] = await Promise.all([
    db.roomType.findUniqueOrThrow({ where: { id: req.roomTypeId } }),
    db.seasonalRate.findMany({ where: { startDate: { lt: req.checkOut }, endDate: { gt: req.checkIn } } }),
    getSettings(),
    req.extraServiceIds?.length ? db.service.findMany({ where: { id: { in: req.extraServiceIds }, active: true, bookable: true } }) : [],
  ]);
  const quote = quoteStay({
    roomType,
    seasons,
    checkIn: req.checkIn,
    checkOut: req.checkOut,
    adults: req.adults,
    children: req.children,
    extras,
    cityTaxPerPersonNight: settings.cityTaxPerPersonNight,
    vatRate: settings.vatRate,
  });
  return { quote, settings };
}

function stayCharges(reservationId: string, roomTypeName: string, quote: Quote, settings: HotelConfig, adults: number, postedById: string | null) {
  const rows: Prisma.FolioChargeCreateManyInput[] = quote.nights.map((n) => ({
    reservationId,
    type: "ROOM",
    description: `${roomTypeName} — ${n.label}`,
    date: n.date,
    quantity: 1,
    unitPrice: n.rate,
    amount: n.rate,
    vatRate: settings.vatRate,
    postedById,
  }));
  if (quote.cityTax > 0) {
    rows.push({
      reservationId,
      type: "CITY_TAX",
      description: `City tax (${adults} × ${quote.nightCount} nights)`,
      date: quote.nights[0]!.date,
      quantity: adults * quote.nightCount,
      unitPrice: settings.cityTaxPerPersonNight,
      amount: quote.cityTax,
      vatRate: 0,
      postedById,
    });
  }
  return rows;
}

// ─── Create ────────────────────────────────────────────────────────────────

export type GuestInput =
  | { id: string }
  | { firstName: string; lastName: string; email: string; phone?: string | null; country?: string | null; userId?: string | null };

export type CreateReservationInput = StayRequest & {
  guest: GuestInput;
  source: BookingSource;
  roomId?: string | null;
  specialRequests?: string | null;
  estimatedArrival?: string | null;
  internalNotes?: string | null;
  createdById?: string | null;
  allowPast?: boolean;
  payment?: { amount: number; method: PaymentMethod; provider: string; reference: string | null; brand?: string | null; last4?: string | null; processedById?: string | null };
};

async function resolveGuest(tx: Tx, guest: GuestInput) {
  if ("id" in guest) return tx.guest.findUniqueOrThrow({ where: { id: guest.id } });
  const email = guest.email.trim().toLowerCase();
  const existing = await tx.guest.findUnique({ where: { email } });
  if (existing) {
    return tx.guest.update({
      where: { id: existing.id },
      data: {
        phone: guest.phone || existing.phone,
        country: guest.country || existing.country,
        userId: existing.userId ?? guest.userId ?? null,
      },
    });
  }
  return tx.guest.create({
    data: {
      firstName: guest.firstName.trim(),
      lastName: guest.lastName.trim(),
      email,
      phone: guest.phone || null,
      country: guest.country || null,
      userId: guest.userId ?? null,
    },
  });
}

export async function createReservation(input: CreateReservationInput) {
  const roomType = await validateStay(input, { allowPast: input.allowPast });
  const { quote, settings } = await quoteReservation(input);

  // Retry when a concurrent booking takes the chosen room (enforced by the database exclusion constraint).
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        let roomId = input.roomId ?? null;
        if (roomId) {
          const room = await tx.room.findUnique({ where: { id: roomId } });
          if (!room || room.roomTypeId !== input.roomTypeId) throw new BookingError("The selected room does not match the room type.");
          if (!(await isRoomFree(tx, roomId, input.checkIn, input.checkOut))) throw new BookingError(`Room ${room.number} is not available for these dates.`);
        } else {
          const free = await findFreeRooms(tx, { roomTypeId: input.roomTypeId, checkIn: input.checkIn, checkOut: input.checkOut });
          const choice = free[attempt] ?? free[0];
          if (!choice) throw new BookingError(`Sorry — the ${roomType.name} is sold out for these dates.`);
          roomId = choice.id;
        }

        const guest = await resolveGuest(tx, input.guest);
        const reservation = await tx.reservation.create({
          data: {
            code: await newReservationCode(tx),
            guestId: guest.id,
            roomTypeId: input.roomTypeId,
            roomId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            adults: input.adults,
            children: input.children,
            status: "CONFIRMED",
            source: input.source,
            specialRequests: input.specialRequests || null,
            estimatedArrival: input.estimatedArrival || null,
            internalNotes: input.internalNotes || null,
            createdById: input.createdById ?? null,
          },
        });

        const charges = stayCharges(reservation.id, roomType.name, quote, settings, input.adults, input.createdById ?? null);
        for (const e of quote.extras) {
          charges.push({
            reservationId: reservation.id,
            type: "SERVICE",
            description: e.name,
            date: input.checkIn,
            quantity: e.quantity,
            unitPrice: e.unitPrice,
            amount: e.amount,
            vatRate: settings.vatRate,
            serviceId: e.serviceId,
            postedById: input.createdById ?? null,
          });
        }
        await tx.folioCharge.createMany({ data: charges });

        if (input.payment) {
          await tx.payment.create({
            data: {
              reservationId: reservation.id,
              amount: input.payment.amount,
              method: input.payment.method,
              provider: input.payment.provider,
              providerRef: input.payment.reference,
              cardBrand: input.payment.brand ?? null,
              cardLast4: input.payment.last4 ?? null,
              processedById: input.payment.processedById ?? null,
            },
          });
        }

        await audit(
          {
            userId: input.createdById,
            action: "reservation.create",
            entity: "Reservation",
            entityId: reservation.id,
            summary: `Created reservation ${reservation.code} for ${guest.firstName} ${guest.lastName} (${toISODate(input.checkIn)} → ${toISODate(input.checkOut)})`,
          },
          tx,
        );
        return reservation;
      });
    } catch (e) {
      if (isOverlapError(e) && attempt < 3) continue;
      if (isOverlapError(e)) throw new BookingError("That room was just booked by someone else. Please try again.");
      throw e;
    }
  }
  throw new BookingError("Unable to complete the booking. Please try again.");
}

/**
 * Website checkout: optionally charges the card first, then creates the reservation.
 * If the reservation cannot be created after a successful charge, the charge is refunded.
 */
export async function bookOnline(input: Omit<CreateReservationInput, "payment" | "source"> & { card?: CardDetails }) {
  const { quote } = await quoteReservation(input);
  let payment: CreateReservationInput["payment"];
  if (input.card) {
    const provider = getPaymentProvider();
    const result = await provider.charge({ amount: quote.total, card: input.card, description: "Hotel Imperial reservation" });
    if (!result.ok) throw new BookingError(result.error);
    payment = { amount: quote.total, method: "CARD", provider: provider.name, reference: result.reference, brand: result.brand, last4: result.last4 };
  }
  try {
    return await createReservation({ ...input, source: "WEBSITE", payment });
  } catch (e) {
    if (payment) await getPaymentProvider().refund({ reference: payment.reference, amount: payment.amount });
    throw e;
  }
}

// ─── Loading ───────────────────────────────────────────────────────────────

export const reservationInclude = {
  guest: true,
  roomType: true,
  room: true,
  charges: { orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { postedBy: { select: { name: true } } } },
  payments: { orderBy: { createdAt: "asc" }, include: { processedBy: { select: { name: true } } } },
  invoice: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.ReservationInclude;

export async function getReservation(id: string) {
  return db.reservation.findUnique({ where: { id }, include: reservationInclude });
}

export type FullReservation = NonNullable<Awaited<ReturnType<typeof getReservation>>>;

export function emailData(r: FullReservation) {
  const folio = summarizeFolio(r);
  return {
    code: r.code,
    guestFirstName: r.guest.firstName,
    guestEmail: r.guest.email ?? "",
    roomTypeName: r.roomType.name,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    nights: nightsBetween(r.checkIn, r.checkOut),
    adults: r.adults,
    children: r.children,
    total: folio.total,
    paid: round2(folio.paid - folio.refunded),
    balance: folio.balance,
  };
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

export async function checkIn(id: string, userId: string, opts: { force?: boolean } = {}) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id }, include: { room: true, roomType: true } });
  if (r.status === "CHECKED_IN") throw new BookingError("The guest is already checked in.");
  if (r.status !== "CONFIRMED" && r.status !== "PENDING") throw new BookingError("Only confirmed reservations can be checked in.");
  const t = today();
  if (t < r.checkIn) throw new BookingError(`Check-in opens on ${toISODate(r.checkIn)}. Modify the stay dates for an early arrival.`);
  if (t >= r.checkOut) throw new BookingError("The stay has already ended. Mark it as a no-show or modify the dates.");

  let room = r.room;
  if (!room) {
    const [free] = await findFreeRooms(db, { roomTypeId: r.roomTypeId, checkIn: r.checkIn, checkOut: r.checkOut });
    if (!free) throw new BookingError("No room of this type is free. Assign a room manually.");
    room = await db.room.findUniqueOrThrow({ where: { id: free.id } });
  }
  if (room.status === "OUT_OF_ORDER") throw new BookingError(`Room ${room.number} is out of order. Assign another room.`);
  // A departing guest may still be in the room on the changeover day.
  const occupant = await db.reservation.findFirst({ where: { roomId: room.id, status: "CHECKED_IN", NOT: { id } }, include: { guest: true } });
  if (occupant) {
    throw new BookingError(`Room ${room.number} is still occupied by ${occupant.guest.firstName} ${occupant.guest.lastName}. Check them out first or move this guest to another room.`);
  }
  if (room.status === "DIRTY" && !opts.force) throw new BookingError(`Room ${room.number} has not been cleaned yet.`);

  await db.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id }, data: { status: "CHECKED_IN", checkedInAt: new Date(), roomId: room.id } });
    await audit({ userId, action: "reservation.checkin", entity: "Reservation", entityId: id, summary: `Checked in ${r.code} to room ${room.number}` }, tx);
  });
  return room;
}

async function nextInvoiceNumber(tx: Tx) {
  const year = new Date().getFullYear();
  const last = await tx.invoice.findFirst({ where: { number: { startsWith: `INV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
  const seq = last ? Number(last.number.split("-")[2]) + 1 : 1;
  return `INV-${year}-${String(seq).padStart(5, "0")}`;
}

export async function issueInvoice(tx: Tx, reservationId: string) {
  const r = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { guest: true, charges: true, payments: true, invoice: true } });
  const folio = summarizeFolio(r);
  const data = {
    netTotal: folio.net,
    vatTotal: folio.vat,
    total: folio.total,
    billTo: `${r.guest.firstName} ${r.guest.lastName}`,
    status: folio.balance <= 0.004 ? ("PAID" as const) : ("ISSUED" as const),
  };
  if (r.invoice) return tx.invoice.update({ where: { id: r.invoice.id }, data });
  return tx.invoice.create({ data: { ...data, reservationId, number: await nextInvoiceNumber(tx) } });
}

/** Re-prices room nights and city tax for the reservation's current dates. */
async function repriceStay(tx: Tx, reservationId: string, postedById: string | null) {
  const r = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { roomType: true } });
  const { quote, settings } = await quoteReservation({ roomTypeId: r.roomTypeId, checkIn: r.checkIn, checkOut: r.checkOut, adults: r.adults, children: r.children });
  await tx.folioCharge.updateMany({
    where: { reservationId, type: { in: ["ROOM", "CITY_TAX"] }, voided: false },
    data: { voided: true, voidReason: "Stay modified — re-priced" },
  });
  await tx.folioCharge.createMany({ data: stayCharges(reservationId, r.roomType.name, quote, settings, r.adults, postedById) });
}

export async function checkOut(id: string, userId: string) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id }, include: { room: true } });
  if (r.status !== "CHECKED_IN") throw new BookingError("Only in-house guests can be checked out.");
  const t = today();

  // Early departure: shorten the stay to the nights actually used (at least one) and re-price.
  // Committed on its own so a resulting credit stays visible for a refund if check-out is blocked.
  const usedUntil = t > r.checkIn ? t : addDays(r.checkIn, 1);
  if (usedUntil < r.checkOut) {
    await db.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { checkOut: usedUntil } });
      await repriceStay(tx, id, userId);
      await audit({ userId, action: "reservation.modify", entity: "Reservation", entityId: id, summary: `Early departure: stay of ${r.code} shortened to ${toISODate(usedUntil)}` }, tx);
    });
  }

  const invoice = await db.$transaction(async (tx) => {
    const fresh = await tx.reservation.findUniqueOrThrow({ where: { id }, include: { charges: true, payments: true } });
    const folio = summarizeFolio(fresh);
    if (folio.balance > 0.004) throw new BookingError(`Outstanding balance of ${formatMoney(folio.balance)} must be settled before check-out.`);
    if (folio.balance < -0.004) throw new BookingError(`The guest has a credit of ${formatMoney(-folio.balance)}. Refund it before check-out.`);

    await tx.reservation.update({ where: { id }, data: { status: "CHECKED_OUT", checkedOutAt: new Date() } });
    if (r.roomId) {
      await tx.room.update({ where: { id: r.roomId }, data: { status: "DIRTY" } });
      const open = await tx.housekeepingTask.findFirst({ where: { roomId: r.roomId, type: { in: ["CHECKOUT_CLEAN", "STAYOVER"] }, status: { not: "DONE" }, dueDate: { lte: t } } });
      if (open) {
        await tx.housekeepingTask.update({ where: { id: open.id }, data: { type: "CHECKOUT_CLEAN", priority: "HIGH", notes: `Departure of ${r.code} — prepare for next arrival` } });
      } else {
        await tx.housekeepingTask.create({ data: { roomId: r.roomId, type: "CHECKOUT_CLEAN", priority: "HIGH", dueDate: t, notes: `Departure of ${r.code}` } });
      }
    }
    const inv = await issueInvoice(tx, id);
    await audit({ userId, action: "reservation.checkout", entity: "Reservation", entityId: id, summary: `Checked out ${r.code}${r.room ? ` from room ${r.room.number}` : ""}, invoice ${inv.number}` }, tx);
    return inv;
  });
  return invoice;
}

function hoursUntilArrival(checkIn: Date, checkInTime: string) {
  const [h, m] = checkInTime.split(":").map(Number);
  // Hotel is in Central European time; approximate arrival in UTC (+1/+2 offset does not change policy materially).
  const arrival = new Date(checkIn.getTime() + ((h ?? 14) - 1) * 3_600_000 + (m ?? 0) * 60_000);
  return (arrival.getTime() - Date.now()) / 3_600_000;
}

export async function cancellationTerms(r: { checkIn: Date; status: string }, settings: HotelConfig) {
  const free = hoursUntilArrival(r.checkIn, settings.checkInTime) >= settings.freeCancellationHours;
  return { free, deadlineHours: settings.freeCancellationHours };
}

/** Refunds up to `amount`, using the original card payments first. Returns the amount refunded. */
export async function refundCredit(reservationId: string, amount: number, userId: string | null, note: string) {
  let remaining = round2(amount);
  if (remaining <= 0) return 0;
  const payments = await db.payment.findMany({ where: { reservationId, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } });
  const charges = payments.filter((p) => p.kind === "CHARGE");
  let total = 0;
  for (const p of charges) {
    if (remaining <= 0) break;
    const share = Math.min(remaining, toNumber(p.amount));
    let reference: string | null = null;
    if (p.method === "CARD" && p.provider !== "manual") {
      const result = await getPaymentProvider().refund({ reference: p.providerRef, amount: share });
      if (!result.ok) throw new BookingError(`Refund failed: ${result.error}`);
      reference = result.reference;
    }
    await db.payment.create({
      data: {
        reservationId,
        kind: "REFUND",
        amount: share,
        method: p.method,
        provider: p.provider,
        providerRef: reference,
        cardBrand: p.cardBrand,
        cardLast4: p.cardLast4,
        note,
        processedById: userId,
      },
    });
    remaining = round2(remaining - share);
    total = round2(total + share);
  }
  return total;
}

export async function cancelReservation(id: string, opts: { userId: string | null; reason: string; waiveFee?: boolean }) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id }, include: { charges: true, roomType: true } });
  if (r.status !== "CONFIRMED" && r.status !== "PENDING") throw new BookingError("Only upcoming reservations can be cancelled.");
  const settings = await getSettings();
  const { free } = await cancellationTerms(r, settings);
  const charge = !free && !opts.waiveFee;

  await db.$transaction(async (tx) => {
    await tx.folioCharge.updateMany({ where: { reservationId: id, voided: false }, data: { voided: true, voidReason: "Reservation cancelled" } });
    if (charge) {
      const firstNight = r.charges.find((c) => c.type === "ROOM" && !c.voided && c.date.getTime() === r.checkIn.getTime());
      const fee = firstNight ? toNumber(firstNight.amount) : toNumber(r.roomType.baseRate);
      await tx.folioCharge.create({
        data: { reservationId: id, type: "FEE", description: "Late cancellation fee (first night)", date: today(), quantity: 1, unitPrice: fee, amount: fee, vatRate: settings.vatRate, postedById: opts.userId },
      });
    }
    await tx.reservation.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: opts.reason } });
    await audit({ userId: opts.userId, action: "reservation.cancel", entity: "Reservation", entityId: id, summary: `Cancelled ${r.code}${charge ? " with late-cancellation fee" : ""}: ${opts.reason}` }, tx);
  });

  const fresh = await db.reservation.findUniqueOrThrow({ where: { id }, include: { charges: true, payments: true } });
  const folio = summarizeFolio(fresh);
  const refunded = folio.balance < 0 ? await refundCredit(id, -folio.balance, opts.userId, "Cancellation refund") : 0;
  return { refunded, feeCharged: charge };
}

export async function markNoShow(id: string, userId: string) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id }, include: { charges: true, roomType: true } });
  if (r.status !== "CONFIRMED") throw new BookingError("Only confirmed reservations can be marked as no-show.");
  if (today() < r.checkIn) throw new BookingError("A reservation can only be marked as a no-show on or after the arrival date.");
  const settings = await getSettings();
  await db.$transaction(async (tx) => {
    const firstNight = r.charges.find((c) => c.type === "ROOM" && !c.voided && c.date.getTime() === r.checkIn.getTime());
    await tx.folioCharge.updateMany({ where: { reservationId: id, voided: false, NOT: firstNight ? { id: firstNight.id } : undefined }, data: { voided: true, voidReason: "No-show" } });
    if (!firstNight) {
      const fee = toNumber(r.roomType.baseRate);
      await tx.folioCharge.create({ data: { reservationId: id, type: "FEE", description: "No-show fee", date: r.checkIn, unitPrice: fee, amount: fee, vatRate: settings.vatRate, postedById: userId } });
    }
    await tx.reservation.update({ where: { id }, data: { status: "NO_SHOW" } });
    await audit({ userId, action: "reservation.noshow", entity: "Reservation", entityId: id, summary: `Marked ${r.code} as no-show` }, tx);
  });
}

export async function assignRoom(id: string, roomId: string, userId: string) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id } });
  if (!ACTIVE_STATUSES.includes(r.status)) throw new BookingError("Rooms can only be assigned to active reservations.");
  const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
  if (room.roomTypeId !== r.roomTypeId) throw new BookingError("Change the room type first to move to a different category.");
  if (room.status === "OUT_OF_ORDER") throw new BookingError(`Room ${room.number} is out of order.`);
  if (!(await isRoomFree(db, roomId, r.checkIn, r.checkOut, id))) throw new BookingError(`Room ${room.number} is occupied on some of these dates.`);
  try {
    await db.reservation.update({ where: { id }, data: { roomId } });
  } catch (e) {
    if (isOverlapError(e)) throw new BookingError(`Room ${room.number} was just taken. Choose another room.`);
    throw e;
  }
  await audit({ userId, action: "reservation.room", entity: "Reservation", entityId: id, summary: `Moved ${r.code} to room ${room.number}` });
}

export async function modifyStay(
  id: string,
  changes: { checkIn: Date; checkOut: Date; adults: number; children: number; roomTypeId: string },
  userId: string,
) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id } });
  if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(r.status)) throw new BookingError("This reservation can no longer be modified.");
  if (r.status === "CHECKED_IN") {
    if (changes.checkIn.getTime() !== r.checkIn.getTime() || changes.roomTypeId !== r.roomTypeId) {
      throw new BookingError("For in-house guests only the departure date and occupancy can be changed. Use a room move to change rooms.");
    }
    if (changes.checkOut <= today() && changes.checkOut.getTime() !== r.checkOut.getTime()) throw new BookingError("Use check-out to end the stay today.");
  }
  await validateStay({ ...changes }, { allowPast: r.status === "CHECKED_IN" });

  let roomId = r.roomId;
  const roomFits = roomId && (await db.room.findUnique({ where: { id: roomId } }))?.roomTypeId === changes.roomTypeId;
  if (!roomFits || !roomId || !(await isRoomFree(db, roomId, changes.checkIn, changes.checkOut, id))) {
    if (r.status === "CHECKED_IN") throw new BookingError("The current room is not available for the new dates.");
    const [free] = await findFreeRooms(db, { roomTypeId: changes.roomTypeId, checkIn: changes.checkIn, checkOut: changes.checkOut, excludeReservationId: id });
    if (!free) throw new BookingError("No room of this type is available for the new dates.");
    roomId = free.id;
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { ...changes, roomId } });
      await repriceStay(tx, id, userId);
      await audit({ userId, action: "reservation.modify", entity: "Reservation", entityId: id, summary: `Modified ${r.code}: ${toISODate(changes.checkIn)} → ${toISODate(changes.checkOut)}, ${changes.adults}+${changes.children} guests` }, tx);
    });
  } catch (e) {
    if (isOverlapError(e)) throw new BookingError("The room was just taken for these dates. Please try again.");
    throw e;
  }
}

// ─── Folio ─────────────────────────────────────────────────────────────────

export async function postCharge(
  reservationId: string,
  input: { serviceId?: string | null; description: string; quantity: number; unitPrice: number; date?: Date; type?: "SERVICE" | "OTHER" | "DISCOUNT" | "FEE" },
  userId: string,
) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  if (["CANCELLED", "NO_SHOW"].includes(r.status)) throw new BookingError("Charges cannot be posted to a cancelled reservation.");
  if (r.status === "CHECKED_OUT") throw new BookingError("The folio is closed after check-out.");
  const settings = await getSettings();
  const amount = round2(input.quantity * input.unitPrice);
  const type = input.type ?? (input.serviceId ? "SERVICE" : "OTHER");
  await db.folioCharge.create({
    data: {
      reservationId,
      type,
      description: input.description,
      date: input.date ?? today(),
      quantity: input.quantity,
      unitPrice: type === "DISCOUNT" ? -Math.abs(input.unitPrice) : input.unitPrice,
      amount: type === "DISCOUNT" ? -Math.abs(amount) : amount,
      vatRate: settings.vatRate,
      serviceId: input.serviceId ?? null,
      postedById: userId,
    },
  });
  await audit({ userId, action: "folio.charge", entity: "Reservation", entityId: reservationId, summary: `Posted ${input.description} (${formatMoney(amount)}) to ${r.code}` });
}

export async function voidCharge(chargeId: string, reason: string, userId: string) {
  const c = await db.folioCharge.findUniqueOrThrow({ where: { id: chargeId }, include: { reservation: true } });
  if (c.voided) throw new BookingError("This charge is already void.");
  if (c.reservation.status === "CHECKED_OUT") throw new BookingError("The folio is closed after check-out.");
  await db.folioCharge.update({ where: { id: chargeId }, data: { voided: true, voidReason: reason } });
  await audit({ userId, action: "folio.void", entity: "Reservation", entityId: c.reservationId, summary: `Voided "${c.description}" (${formatMoney(c.amount)}) on ${c.reservation.code}: ${reason}` });
}

export async function recordPayment(
  reservationId: string,
  input: { amount: number; method: PaymentMethod; note?: string | null; card?: CardDetails },
  userId: string | null,
) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { charges: true, payments: true } });
  const amount = round2(input.amount);
  if (amount <= 0) throw new BookingError("Enter an amount greater than zero.");
  let provider = "manual";
  let reference: string | null = null;
  let brand: string | null = null;
  let last4: string | null = null;
  if (input.card) {
    const gateway = getPaymentProvider();
    const result = await gateway.charge({ amount, card: input.card, description: `Reservation ${r.code}` });
    if (!result.ok) throw new BookingError(result.error);
    provider = gateway.name;
    reference = result.reference;
    brand = result.brand;
    last4 = result.last4;
  }
  await db.payment.create({
    data: { reservationId, amount, method: input.method, provider, providerRef: reference, cardBrand: brand, cardLast4: last4, note: input.note || null, processedById: userId },
  });
  if (r.status === "CHECKED_OUT") await db.$transaction((tx) => issueInvoice(tx, reservationId));
  await audit({ userId, action: "payment.record", entity: "Reservation", entityId: reservationId, summary: `Recorded ${input.method.toLowerCase().replace("_", " ")} payment of ${formatMoney(amount)} on ${r.code}` });
}
