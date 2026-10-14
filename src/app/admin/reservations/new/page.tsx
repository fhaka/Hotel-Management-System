import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addDaysISO, toISODate, todayISO } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import { NewReservationForm } from "./form";

export const metadata: Metadata = { title: "New reservation" };

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ guestId?: string; checkIn?: string; roomTypeId?: string; groupId?: string; companyId?: string }> }) {
  await requireStaff("reservations");
  const sp = await searchParams;
  const [roomTypes, services, companies, guest, group] = await Promise.all([
    db.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.service.findMany({ where: { active: true, bookable: true }, orderBy: { name: "asc" } }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, taxId: true } }),
    sp.guestId ? db.guest.findUnique({ where: { id: sp.guestId } }) : null,
    sp.groupId ? db.reservationGroup.findUnique({ where: { id: sp.groupId }, include: { booker: true, company: true, reservations: { orderBy: { createdAt: "asc" }, take: 1 } } }) : null,
  ]);
  const today = todayISO();
  const groupStay = group?.reservations[0];
  const checkIn = groupStay ? toISODate(groupStay.checkIn) : sp.checkIn && sp.checkIn >= today ? sp.checkIn : today;
  const checkOut = groupStay ? toISODate(groupStay.checkOut) : addDaysISO(checkIn, 1);
  const booker = group?.booker ?? guest;

  return (
    <>
      <PageHeader
        back={group ? { href: `/admin/groups/${group.id}`, label: group.name } : { href: "/admin/reservations", label: "Reservations" }}
        title={group ? `Add rooms to ${group.name}` : "New reservation"}
        description={group ? `Rooms are added to group ${group.code} and its bill.` : "Book one or several rooms for a walk-in, phone, email or corporate request."}
      />
      <NewReservationForm
        today={today}
        defaults={{ checkIn, checkOut, roomTypeId: sp.roomTypeId ?? roomTypes[0]?.id ?? "" }}
        roomTypes={roomTypes.map((t) => ({ id: t.id, name: t.name, maxAdults: t.maxAdults, maxChildren: t.maxChildren, baseRate: toNumber(t.baseRate) }))}
        services={services.map((s) => ({ id: s.id, name: s.name, price: toNumber(s.price), unit: s.unit }))}
        companies={companies}
        initialCompanyId={sp.companyId ?? ""}
        group={group ? { id: group.id, code: group.code, name: group.name, company: group.company?.name ?? null } : null}
        initialGuest={booker ? { id: booker.id, firstName: booker.firstName, lastName: booker.lastName, email: booker.email, phone: booker.phone, country: booker.country, vip: booker.vip } : null}
      />
    </>
  );
}
