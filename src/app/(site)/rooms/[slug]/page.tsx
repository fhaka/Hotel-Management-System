import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Check, ChevronLeft, Maximize2, Mountain, Users } from "lucide-react";
import { BookingBar } from "@/components/booking-bar";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const rt = await db.roomType.findUnique({ where: { slug } });
  return { title: rt?.name ?? "Room", description: rt?.tagline };
}

export default async function RoomDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [rt, others, hotel] = await Promise.all([
    db.roomType.findUnique({ where: { slug } }),
    db.roomType.findMany({ where: { active: true, NOT: { slug } }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  if (!rt || !rt.active) notFound();

  return (
    <div className="pt-20">
      <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
        <Link href="/rooms" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" /> All rooms & suites
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">{rt.tagline}</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">{rt.name}</h1>
          </div>
          <p>
            <span className="text-sm text-muted-foreground">From </span>
            <span className="font-serif text-4xl text-primary">{formatMoney(rt.baseRate, { compact: true })}</span>
            <span className="text-sm text-muted-foreground"> / night</span>
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
            <Image src={rt.images[0]!} alt={rt.name} fill priority sizes="(min-width:768px) 66vw, 100vw" className="object-cover" />
          </div>
          <div className="grid gap-4">
            {rt.images.slice(1, 3).map((src, i) => (
              <div key={src} className="relative aspect-[16/10] overflow-hidden rounded-2xl md:aspect-auto">
                <Image src={src} alt={`${rt.name} view ${i + 2}`} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-ivory p-6 sm:grid-cols-4">
            {[
              [Maximize2, "Size", `${rt.sizeSqm} m²`],
              [BedDouble, "Bed", rt.bedType],
              [Users, "Occupancy", `${rt.maxAdults} adults · ${rt.maxChildren} children`],
              [Mountain, "View", rt.view],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Users;
              return (
                <div key={label as string}>
                  <I className="size-5 text-gold" />
                  <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{label as string}</p>
                  <p className="mt-0.5 text-sm font-medium">{value as string}</p>
                </div>
              );
            })}
          </div>
          <h2 className="mt-10 font-serif text-3xl text-primary">About this room</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{rt.description}</p>
          <h2 className="mt-10 font-serif text-3xl text-primary">Amenities</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {rt.amenities.map((a) => (
              <li key={a} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
                <Check className="size-4 text-gold" /> {a}
              </li>
            ))}
          </ul>
          <h2 className="mt-10 font-serif text-3xl text-primary">Policies</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Check-in from {hotel.checkInTime}, check-out until {hotel.checkOutTime}.</li>
            <li>Free cancellation up to {hotel.freeCancellationHours} hours before arrival; later cancellations are charged the first night.</li>
            <li>City tax of {formatMoney(hotel.cityTaxPerPersonNight)} per adult per night is payable in addition. Prices include {hotel.vatRate}% VAT.</li>
            {rt.weekendRate && <li>Friday and Saturday nights from {formatMoney(rt.weekendRate, { compact: true })}. Seasonal rates may apply.</li>}
          </ul>
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-lg shadow-primary/5">
            <p className="font-serif text-2xl text-primary">Check availability</p>
            <p className="mt-1 text-sm text-muted-foreground">Best rate guaranteed when booking direct.</p>
            <div className="mt-5 [&_form]:md:grid-cols-1">
              <BookingBar today={todayISO()} variant="inline" />
            </div>
          </div>
        </aside>
      </section>

      <section className="border-t border-border bg-ivory py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-serif text-3xl text-primary">You may also like</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {others.map((o) => (
              <Link key={o.id} href={`/rooms/${o.slug}`} className="group overflow-hidden rounded-2xl border border-border bg-white">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image src={o.images[0]!} alt={o.name} fill sizes="33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="p-5">
                  <p className="font-serif text-xl text-primary">{o.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">From {formatMoney(o.baseRate, { compact: true })} / night</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
