import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, BedDouble, Check, Maximize2, Users } from "lucide-react";
import { BookingBar } from "@/components/booking-bar";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { availabilityByType } from "@/lib/availability";
import { db } from "@/lib/db";
import { formatLongDate, parseISODate, todayISO } from "@/lib/dates";
import { formatMoney, pluralize } from "@/lib/format";
import { quoteStay } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Steps } from "@/components/booking-steps";
import { parseStaySearch, searchQuery } from "./search-params";

export const metadata: Metadata = { title: "Book your stay" };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = parseStaySearch(await searchParams);
  const checkIn = parseISODate(search.checkIn);
  const checkOut = parseISODate(search.checkOut);

  const [roomTypes, seasons, settings, availability] = await Promise.all([
    db.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.seasonalRate.findMany({ where: { startDate: { lt: checkOut }, endDate: { gt: checkIn } } }),
    getSettings(),
    availabilityByType(checkIn, checkOut),
  ]);

  const results = roomTypes
    .map((rt) => {
      const quote = quoteStay({
        roomType: rt,
        seasons,
        checkIn,
        checkOut,
        adults: search.adults,
        children: search.children,
        cityTaxPerPersonNight: settings.cityTaxPerPersonNight,
        vatRate: settings.vatRate,
      });
      const fits = search.adults <= rt.maxAdults && search.children <= rt.maxChildren;
      return { rt, quote, left: availability.get(rt.id) ?? 0, fits };
    })
    .sort((a, b) => Number(b.rt.slug === search.roomType) - Number(a.rt.slug === search.roomType));

  const anyAvailable = results.some((r) => r.fits && r.left > 0);

  return (
    <div className="bg-ivory pb-24 pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Steps current={1} />
        <h1 className="mt-6 font-serif text-4xl text-primary sm:text-5xl">Choose your room</h1>
        <p className="mt-2 text-muted-foreground">
          {formatLongDate(checkIn)} – {formatLongDate(checkOut)} · {pluralize(results[0]?.quote.nightCount ?? 0, "night")} ·{" "}
          {pluralize(search.adults, "adult")}
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
        {!anyAvailable && (
          <div className="mt-6 rounded-xl border border-border bg-white p-6 text-center">
            <p className="font-serif text-2xl text-primary">We&apos;re fully booked for these dates</p>
            <p className="mt-2 text-sm text-muted-foreground">Try different dates, or contact our reservations team — we may be able to help.</p>
            <ButtonLink href="/contact" variant="outline" className="mt-4">
              Contact reservations
            </ButtonLink>
          </div>
        )}

        <div className="mt-8 space-y-5">
          {results.map(({ rt, quote, left, fits }) => {
            const bookable = fits && left > 0;
            return (
              <article
                key={rt.id}
                className={cn(
                  "grid overflow-hidden rounded-2xl border bg-white md:grid-cols-[320px_1fr]",
                  rt.slug === search.roomType ? "border-gold shadow-lg shadow-gold/10" : "border-border",
                  !bookable && "opacity-75",
                )}
              >
                <div className="relative aspect-[16/10] md:aspect-auto">
                  <Image src={rt.images[0]!} alt={rt.name} fill sizes="320px" className="object-cover" />
                </div>
                <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-2xl text-primary">{rt.name}</h2>
                      {bookable && left <= 3 && <Badge tone="warning">Only {left} left</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{rt.tagline}</p>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/75">
                      <span className="flex items-center gap-1.5"><Maximize2 className="size-4 text-gold" /> {rt.sizeSqm} m²</span>
                      <span className="flex items-center gap-1.5"><BedDouble className="size-4 text-gold" /> {rt.bedType}</span>
                      <span className="flex items-center gap-1.5"><Users className="size-4 text-gold" /> Up to {rt.maxAdults} adults, {rt.maxChildren} children</span>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                      {rt.amenities.slice(0, 4).map((a) => (
                        <li key={a} className="flex items-center gap-1.5"><Check className="size-3.5 text-success" /> {a}</li>
                      ))}
                    </ul>
                    <Link href={`/rooms/${rt.slug}`} className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
                      Room details
                    </Link>
                  </div>
                  <div className="shrink-0 border-t border-border pt-5 lg:w-56 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:text-right">
                    {bookable ? (
                      <>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total for {pluralize(quote.nightCount, "night")}</p>
                        <p className="mt-1 font-serif text-3xl text-primary">{formatMoney(quote.roomTotal)}</p>
                        <p className="text-xs text-muted-foreground">
                          avg. {formatMoney(quote.roomTotal / quote.nightCount)} / night · incl. VAT
                        </p>
                        <ButtonLink href={`/book/checkout?${searchQuery(search, { roomType: rt.slug })}`} className="mt-4 w-full">
                          Select
                        </ButtonLink>
                        <p className="mt-2 text-xs text-success">Free cancellation · No prepayment needed</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-muted-foreground">
                        {fits ? "Sold out for these dates" : `Not suitable for ${pluralize(search.adults + search.children, "guest")}`}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
