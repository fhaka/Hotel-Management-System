import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Steps } from "@/components/booking-steps";
import { availabilityByType } from "@/lib/availability";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { parseISODate } from "@/lib/dates";
import { isDemoMode } from "@/lib/demo";
import { toNumber } from "@/lib/format";
import { DEMO_CARDS } from "@/lib/payments/demo";
import { getSettings } from "@/lib/settings";
import { distributeGuests, parseSelection, parseStaySearch, searchQuery, selectionParam } from "../search-params";
import { CheckoutForm } from "./checkout-form";
import { loadRestrictions } from "@/lib/reservations";
import { restrictionViolation } from "@/lib/booking-rules";

export const metadata: Metadata = { title: "Guest details & payment" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const search = parseStaySearch(sp);
  const selection = parseSelection(sp);
  const back = `/book?${searchQuery(search, selection.length ? { rooms: selectionParam(selection) } : {})}`;
  if (!search.provided || search.error || selection.length === 0) redirect(back);
  const checkIn = parseISODate(search.checkIn);
  const checkOut = parseISODate(search.checkOut);

  const [types, availability, seasons, services, settings, user] = await Promise.all([
    db.roomType.findMany({ where: { slug: { in: selection.map((s) => s.slug) }, active: true } }),
    availabilityByType(checkIn, checkOut),
    db.seasonalRate.findMany({ where: { startDate: { lt: checkOut }, endDate: { gt: checkIn } } }),
    db.service.findMany({ where: { active: true, bookable: true }, orderBy: { price: "asc" } }),
    getSettings(),
    getCurrentUser(),
  ]);
  // Every selected type must exist and still have enough free rooms.
  const lines = selection.flatMap((s) => {
    const t = types.find((x) => x.slug === s.slug);
    return t ? Array.from({ length: s.qty }, () => t) : [];
  });
  const enough = selection.every((s) => {
    const t = types.find((x) => x.slug === s.slug);
    return t && (availability.get(t.id) ?? 0) >= s.qty;
  });
  if (!enough || lines.length === 0) redirect(back);
  const rules = await loadRestrictions(checkIn, checkOut);
  if (types.some((t) => restrictionViolation({ checkIn, checkOut, roomTypeId: t.id }, rules))) redirect(back);
  const occupancy = distributeGuests(lines, search.adults, search.children) ?? lines.map((t) => ({ adults: Math.min(2, t.maxAdults), children: 0 }));

  const guest = user?.guest ? await db.guest.findUnique({ where: { id: user.guest.id } }) : null;
  const [first, ...rest] = (user?.name ?? "").split(" ");

  return (
    <div className="bg-ivory pb-24 pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Steps current={2} />
        <h1 className="mt-6 font-serif text-4xl text-primary sm:text-5xl">Complete your reservation</h1>
        <CheckoutForm
          search={{ checkIn: search.checkIn, checkOut: search.checkOut }}
          backHref={back}
          rooms={lines.map((t, i) => ({
            roomTypeId: t.id,
            slug: t.slug,
            name: t.name,
            image: t.images[0]!,
            baseRate: toNumber(t.baseRate),
            weekendRate: t.weekendRate ? toNumber(t.weekendRate) : null,
            maxAdults: t.maxAdults,
            maxChildren: t.maxChildren,
            adults: occupancy[i]!.adults,
            children: occupancy[i]!.children,
          }))}
          seasons={seasons.map((s) => ({ name: s.name, startDate: s.startDate.toISOString(), endDate: s.endDate.toISOString(), multiplier: toNumber(s.multiplier), roomTypeId: s.roomTypeId }))}
          services={services.map((s) => ({ id: s.id, name: s.name, description: s.description ?? "", price: toNumber(s.price), unit: s.unit, perNight: s.perNight, perGuest: s.perGuest }))}
          settings={{ cityTax: settings.cityTaxPerPersonNight, vatRate: settings.vatRate, checkInTime: settings.checkInTime, freeCancellationHours: settings.freeCancellationHours }}
          prefill={
            user?.role === "GUEST"
              ? {
                  firstName: guest?.firstName ?? first ?? "",
                  lastName: guest?.lastName ?? rest.join(" "),
                  email: guest?.email ?? user.email,
                  phone: guest?.phone ?? user.phone ?? "",
                  country: guest?.country ?? "",
                }
              : null
          }
          signedIn={user?.role === "GUEST"}
          demoCards={isDemoMode() ? DEMO_CARDS : null}
        />
      </div>
    </div>
  );
}
