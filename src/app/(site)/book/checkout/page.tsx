import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Steps } from "@/components/booking-steps";
import { findFreeRooms } from "@/lib/availability";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { parseISODate } from "@/lib/dates";
import { isDemoMode } from "@/lib/demo";
import { toNumber } from "@/lib/format";
import { DEMO_CARDS } from "@/lib/payments/demo";
import { getSettings } from "@/lib/settings";
import { parseStaySearch, searchQuery } from "../search-params";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Guest details & payment" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = parseStaySearch(await searchParams);
  if (!search.provided || !search.roomType || search.error) redirect(`/book?${searchQuery(search)}`);
  const checkIn = parseISODate(search.checkIn);
  const checkOut = parseISODate(search.checkOut);

  const roomType = await db.roomType.findUnique({ where: { slug: search.roomType } });
  if (!roomType || !roomType.active || search.adults > roomType.maxAdults || search.children > roomType.maxChildren) {
    redirect(`/book?${searchQuery(search)}`);
  }

  const [free, seasons, services, settings, user] = await Promise.all([
    findFreeRooms(db, { roomTypeId: roomType.id, checkIn, checkOut }),
    db.seasonalRate.findMany({ where: { startDate: { lt: checkOut }, endDate: { gt: checkIn } } }),
    db.service.findMany({ where: { active: true, bookable: true }, orderBy: { price: "asc" } }),
    getSettings(),
    getCurrentUser(),
  ]);
  if (free.length === 0) redirect(`/book?${searchQuery(search)}`);

  const guest = user?.guest ? await db.guest.findUnique({ where: { id: user.guest.id } }) : null;

  return (
    <div className="bg-ivory pb-24 pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Steps current={2} />
        <h1 className="mt-6 font-serif text-4xl text-primary sm:text-5xl">Complete your reservation</h1>
        <CheckoutForm
          search={{ checkIn: search.checkIn, checkOut: search.checkOut, adults: search.adults, children: search.children }}
          roomType={{
            id: roomType.id,
            slug: roomType.slug,
            name: roomType.name,
            image: roomType.images[0]!,
            baseRate: toNumber(roomType.baseRate),
            weekendRate: roomType.weekendRate ? toNumber(roomType.weekendRate) : null,
          }}
          seasons={seasons.map((s) => ({ name: s.name, startDate: s.startDate.toISOString(), endDate: s.endDate.toISOString(), multiplier: toNumber(s.multiplier), roomTypeId: s.roomTypeId }))}
          services={services.map((s) => ({ id: s.id, name: s.name, description: s.description ?? "", price: toNumber(s.price), unit: s.unit, perNight: s.perNight, perGuest: s.perGuest }))}
          settings={{ cityTax: settings.cityTaxPerPersonNight, vatRate: settings.vatRate, checkInTime: settings.checkInTime, freeCancellationHours: settings.freeCancellationHours }}
          prefill={
            guest
              ? { firstName: guest.firstName, lastName: guest.lastName, email: guest.email ?? user!.email, phone: guest.phone ?? "", country: guest.country ?? "" }
              : user
                ? { firstName: user.name.split(" ")[0] ?? "", lastName: user.name.split(" ").slice(1).join(" "), email: user.email, phone: user.phone ?? "", country: "" }
                : null
          }
          signedIn={!!user}
          demoCards={isDemoMode() ? DEMO_CARDS : null}
        />
      </div>
    </div>
  );
}
