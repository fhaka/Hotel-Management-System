import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addDaysISO, todayISO } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import { NewReservationForm } from "./form";

export const metadata: Metadata = { title: "New reservation" };

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ guestId?: string; checkIn?: string; roomTypeId?: string }> }) {
  await requireStaff("reservations");
  const sp = await searchParams;
  const [roomTypes, services, guest] = await Promise.all([
    db.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.service.findMany({ where: { active: true, bookable: true }, orderBy: { name: "asc" } }),
    sp.guestId ? db.guest.findUnique({ where: { id: sp.guestId } }) : null,
  ]);
  const today = todayISO();
  const checkIn = sp.checkIn && sp.checkIn >= today ? sp.checkIn : today;

  return (
    <>
      <PageHeader back={{ href: "/admin/reservations", label: "Reservations" }} title="New reservation" description="Create a booking for a walk-in, phone or email request." />
      <NewReservationForm
        today={today}
        defaults={{ checkIn, checkOut: addDaysISO(checkIn, 1), roomTypeId: sp.roomTypeId ?? roomTypes[0]?.id ?? "" }}
        roomTypes={roomTypes.map((t) => ({ id: t.id, name: t.name, maxAdults: t.maxAdults, maxChildren: t.maxChildren, baseRate: toNumber(t.baseRate) }))}
        services={services.map((s) => ({ id: s.id, name: s.name, price: toNumber(s.price), unit: s.unit }))}
        initialGuest={guest ? { id: guest.id, firstName: guest.firstName, lastName: guest.lastName, email: guest.email, phone: guest.phone, country: guest.country, vip: guest.vip } : null}
      />
    </>
  );
}
