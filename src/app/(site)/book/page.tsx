import type { Metadata } from "next";
import { AlertCircle, Info } from "lucide-react";
import { BookingBar } from "@/components/booking-bar";
import { Steps } from "@/components/booking-steps";
import { ButtonLink } from "@/components/ui/button";
import { availabilityByType } from "@/lib/availability";
import { db } from "@/lib/db";
import { formatLongDate, nightsBetween, parseISODate, todayISO } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import { nightlyRate } from "@/lib/pricing";
import { round2 } from "@/lib/format";
import { eachNight } from "@/lib/dates";
import { RoomPicker } from "./room-picker";
import { loadRestrictions } from "@/lib/reservations";
import { restrictionViolation } from "@/lib/booking-rules";
import { parseSelection, parseStaySearch } from "./search-params";

export const metadata: Metadata = { title: "Book your stay" };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const search = parseStaySearch(sp);
  const checkIn = parseISODate(search.checkIn);
  const checkOut = parseISODate(search.checkOut);
  const nights = nightsBetween(checkIn, checkOut);

  const [roomTypes, seasons, availability, rules] = await Promise.all([
    db.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.seasonalRate.findMany({ where: { startDate: { lt: checkOut }, endDate: { gt: checkIn } } }),
    availabilityByType(checkIn, checkOut),
    loadRestrictions(checkIn, checkOut),
  ]);

  const rooms = roomTypes.map((rt) => ({
    slug: rt.slug,
    name: rt.name,
    tagline: rt.tagline,
    image: rt.images[0]!,
    sizeSqm: rt.sizeSqm,
    bedType: rt.bedType,
    maxAdults: rt.maxAdults,
    maxChildren: rt.maxChildren,
    amenities: rt.amenities.slice(0, 4),
    roomTotal: round2(eachNight(checkIn, checkOut).reduce((s, d) => s + nightlyRate(rt, d, seasons).rate, 0)),
    nights,
    left: availability.get(rt.id) ?? 0,
    blocked: restrictionViolation({ checkIn, checkOut, roomTypeId: rt.id }, rules),
  }));
  const fitsOneRoom = rooms.some((r) => r.left > 0 && !r.blocked && search.adults <= r.maxAdults && search.children <= r.maxChildren);
  const anyAvailable = rooms.some((r) => r.left > 0 && !r.blocked);
  const ruleMessage = !anyAvailable ? rooms.find((r) => r.blocked)?.blocked : null;
  // Pre-select only what is actually available.
  const initial = parseSelection(sp).filter((s) => rooms.some((r) => r.slug === s.slug && r.left >= s.qty && !r.blocked));

  return (
    <div className="bg-ivory pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Steps current={1} />
        <h1 className="mt-6 font-serif text-4xl text-primary sm:text-5xl">Choose your rooms</h1>
        <p className="mt-2 text-muted-foreground">
          {formatLongDate(checkIn)} – {formatLongDate(checkOut)} · {pluralize(nights, "night")} · {pluralize(search.adults, "adult")}
          {search.children ? `, ${pluralize(search.children, "child", "children")}` : ""}
        </p>
        <div className="mt-6">
          <BookingBar today={todayISO()} initial={search} variant="inline" />
        </div>
        {search.error && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertCircle className="size-4" /> {search.error}
          </p>
        )}
        {anyAvailable && !fitsOneRoom && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
            <Info className="size-4 shrink-0" /> Your party of {pluralize(search.adults + search.children, "guest")} needs more than one room — choose several rooms below and book them together.
          </p>
        )}
        {!anyAvailable && (
          <div className="mt-6 rounded-xl border border-border bg-white p-6 text-center">
            <p className="font-serif text-2xl text-primary">{ruleMessage ? "Not bookable online for these dates" : "We’re fully booked for these dates"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{ruleMessage ?? "Try different dates, or contact our reservations team — we may be able to help."}</p>
            <ButtonLink href="/contact" variant="outline" className="mt-4">
              Contact reservations
            </ButtonLink>
          </div>
        )}
        <RoomPicker
          key={`${search.checkIn}-${search.checkOut}-${search.adults}-${search.children}`}
          rooms={rooms}
          search={{ checkIn: search.checkIn, checkOut: search.checkOut, adults: search.adults, children: search.children }}
          initial={initial}
          highlight={initial[0]?.slug}
        />
      </div>
    </div>
  );
}
