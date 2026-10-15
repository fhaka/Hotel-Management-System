"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BedDouble, Check, Maximize2, Minus, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { formatMoney, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { distributeGuests, searchQuery, selectionParam, type RoomSelection } from "./search-params";

export type PickerRoom = {
  slug: string;
  name: string;
  tagline: string;
  image: string;
  sizeSqm: number;
  bedType: string;
  maxAdults: number;
  maxChildren: number;
  amenities: string[];
  roomTotal: number;
  nights: number;
  left: number;
  /** Why the room type cannot be booked online for these dates (booking rule), if any. */
  blocked: string | null;
};

export function RoomPicker({
  rooms,
  search,
  initial,
  highlight,
}: {
  rooms: PickerRoom[];
  search: { checkIn: string; checkOut: string; adults: number; children: number };
  initial: RoomSelection;
  highlight?: string;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(initial.map((s) => [s.slug, s.qty])));
  const selected = rooms.flatMap((r) => Array.from({ length: qty[r.slug] ?? 0 }, () => r));
  const count = selected.length;
  const total = selected.reduce((s, r) => s + r.roomTotal, 0);
  const fits = count > 0 && distributeGuests(selected, search.adults, search.children) !== null;
  const party = search.adults + search.children;
  const capacity = selected.reduce((s, r) => s + r.maxAdults + r.maxChildren, 0);

  const set = (slug: string, value: number, max: number) => setQty((q) => ({ ...q, [slug]: Math.max(0, Math.min(value, max, 8)) }));
  const go = (sel: RoomSelection) => router.push(`/book/checkout?${searchQuery(search, { rooms: selectionParam(sel) })}`);

  let hint = "";
  if (count === 0) hint = `Select rooms for ${pluralize(party, "guest")}`;
  else if (count > search.adults) hint = "Each room needs at least one adult";
  else if (!fits) hint = `Selected rooms sleep up to ${capacity} — add a room for ${pluralize(party, "guest")}`;

  return (
    <>
      <div className="mt-8 space-y-5 pb-28">
        {rooms.map((rt) => {
          const n = qty[rt.slug] ?? 0;
          const soldOut = rt.left === 0 || !!rt.blocked;
          const singleFits = search.adults <= rt.maxAdults && search.children <= rt.maxChildren;
          return (
            <article
              key={rt.slug}
              className={cn(
                "grid overflow-hidden rounded-2xl border bg-white md:grid-cols-[320px_1fr]",
                n > 0 ? "border-gold shadow-lg shadow-gold/10" : rt.slug === highlight ? "border-gold/50" : "border-border",
                soldOut && "opacity-70",
              )}
            >
              <div className="relative aspect-[16/10] md:aspect-auto">
                <Image src={rt.image} alt={rt.name} fill sizes="320px" className="object-cover" />
                {n > 0 && <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-1 text-xs font-semibold text-white">{n} selected</span>}
              </div>
              <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-2xl text-primary">{rt.name}</h2>
                    {!soldOut && rt.left <= 3 && <Badge tone="warning">Only {rt.left} left</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{rt.tagline}</p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/75">
                    <span className="flex items-center gap-1.5"><Maximize2 className="size-4 text-gold" /> {rt.sizeSqm} m²</span>
                    <span className="flex items-center gap-1.5"><BedDouble className="size-4 text-gold" /> {rt.bedType}</span>
                    <span className="flex items-center gap-1.5"><Users className="size-4 text-gold" /> Sleeps {rt.maxAdults} adults + {rt.maxChildren} children</span>
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {rt.amenities.map((a) => (
                      <li key={a} className="flex items-center gap-1.5"><Check className="size-3.5 text-success" /> {a}</li>
                    ))}
                  </ul>
                  <Link href={`/rooms/${rt.slug}`} className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
                    Room details
                  </Link>
                </div>
                <div className="shrink-0 border-t border-border pt-5 lg:w-60 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:text-right">
                  {soldOut ? (
                    <p className="text-sm font-medium text-muted-foreground">{rt.blocked ?? "Sold out for these dates"}</p>
                  ) : (
                    <>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Per room, {pluralize(rt.nights, "night")}</p>
                      <p className="mt-1 font-serif text-3xl text-primary">{formatMoney(rt.roomTotal)}</p>
                      <p className="text-xs text-muted-foreground">avg. {formatMoney(rt.roomTotal / rt.nights)} / night · incl. VAT</p>
                      <div className="mt-4 flex items-center justify-between gap-2 lg:justify-end">
                        <div className="flex items-center rounded-lg border border-input">
                          <button type="button" onClick={() => set(rt.slug, n - 1, rt.left)} disabled={n === 0} className="flex size-10 cursor-pointer items-center justify-center text-foreground disabled:opacity-30" aria-label={`Remove a ${rt.name}`}>
                            <Minus className="size-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{n}</span>
                          <button type="button" onClick={() => set(rt.slug, n + 1, rt.left)} disabled={n >= rt.left || n >= 8} className="flex size-10 cursor-pointer items-center justify-center text-foreground disabled:opacity-30" aria-label={`Add a ${rt.name}`}>
                            <Plus className="size-4" />
                          </button>
                        </div>
                        {singleFits && count === 0 && (
                          <Button size="md" onClick={() => go([{ slug: rt.slug, qty: 1 }])}>
                            Book
                          </Button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-success">Free cancellation · No prepayment needed</p>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur transition-transform", count === 0 && "translate-y-full")} aria-hidden={count === 0}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <p className="font-medium">
              {pluralize(count, "room")} selected · <span className="text-primary">{formatMoney(total)}</span>
              <span className="text-sm font-normal text-muted-foreground"> for {pluralize(rooms[0]?.nights ?? 0, "night")}, before extras & city tax</span>
            </p>
            <p className={cn("text-sm", fits ? "text-success" : "text-warning")}>{fits ? `Fits your party of ${pluralize(party, "guest")}` : hint}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setQty({})}>Clear</Button>
            <Button size="lg" disabled={!fits} onClick={() => go(rooms.map((r) => ({ slug: r.slug, qty: qty[r.slug] ?? 0 })))}>
              Continue <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
