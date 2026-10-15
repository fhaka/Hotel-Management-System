import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { Pagination, buildHref, pageParam } from "@/components/pagination";
import { Stars } from "@/components/stars";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { reviewStats } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Guest reviews", description: "What guests say about their stay at Hotel Imperial, Tirana." };

const SIZE = 10;
const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ stars?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const filter = sp.stars === "5" ? 5 : sp.stars === "4" ? 4 : sp.stars === "low" ? "low" : null;
  const where: Prisma.ReviewWhereInput = {
    status: "PUBLISHED",
    ...(filter === "low" ? { rating: { lte: 3 } } : filter ? { rating: filter } : {}),
  };
  const [stats, total, reviews] = await Promise.all([
    reviewStats(),
    db.review.count({ where }),
    db.review.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { reservation: { select: { roomType: { select: { name: true } } } } } }),
  ]);
  const max = Math.max(1, ...stats.distribution.map((d) => d.count));
  const chip = (value: string | undefined, label: string) => (
    <Link
      href={buildHref("/reviews", { stars: value })}
      className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", (sp.stars ?? undefined) === value ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}
    >
      {label}
    </Link>
  );

  return (
    <div className="bg-ivory pb-24 pt-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="eyebrow">Guest reviews</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">In our guests&apos; words</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Every review comes from a verified stay at Hotel Imperial and is published after a short check by our team.</p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="flex items-end gap-3">
                <span className="font-serif text-6xl leading-none text-primary">{stats.average.toFixed(1)}</span>
                <div className="pb-1">
                  <Stars value={stats.average} size="md" />
                  <p className="mt-1 text-sm text-muted-foreground">{stats.count} reviews</p>
                </div>
              </div>
              <ul className="mt-6 space-y-2">
                {stats.distribution.map((d) => (
                  <li key={d.stars} className="flex items-center gap-3 text-sm">
                    <span className="w-12 text-muted-foreground">{d.stars} star{d.stars > 1 ? "s" : ""}</span>
                    <span className="h-2 flex-1 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-gold" style={{ width: `${(d.count / max) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{d.count}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-2 border-t border-border pt-5">
                {stats.categories.filter((c) => c.average != null).map((c) => (
                  <div key={c.key} className="flex items-center justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="flex items-center gap-2">
                      <Stars value={c.average!} />
                      <span className="w-7 text-right font-medium tabular-nums">{c.average!.toFixed(1)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden rounded-2xl border border-border bg-primary p-6 text-white lg:block">
              <p className="font-serif text-2xl">Experience it yourself</p>
              <p className="mt-2 text-sm text-white/70">Book direct for our best available rate.</p>
              <ButtonLink href="/book" variant="gold" className="mt-4">Check availability</ButtonLink>
            </div>
          </aside>

          <section>
            <div className="mb-5 flex flex-wrap gap-2">
              {chip(undefined, "All")}
              {chip("5", "5 stars")}
              {chip("4", "4 stars")}
              {chip("low", "3 stars & below")}
            </div>
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white">
                <EmptyState icon={<MessageSquareQuote />} title="No reviews match this filter" />
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <article key={r.id} className="rounded-2xl border border-border bg-white p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Stars value={r.rating} size="md" />
                      <span className="text-xs text-muted-foreground">{monthYear.format(r.createdAt)}</span>
                    </div>
                    <h2 className="mt-3 font-serif text-2xl text-primary">{r.title}</h2>
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-foreground/80">{r.body}</p>
                    <p className="mt-4 text-sm font-medium">
                      {r.guestName}
                      <span className="font-normal text-muted-foreground">
                        {r.country ? ` · ${r.country}` : ""}
                        {r.reservation?.roomType ? ` · stayed in a ${r.reservation.roomType.name}` : ""}
                      </span>
                    </p>
                    {r.response && (
                      <div className="mt-4 rounded-xl border-l-4 border-gold bg-gold-soft/40 px-4 py-3 text-sm">
                        <p className="font-medium text-[#7a5d2c]">Response from Hotel Imperial</p>
                        <p className="mt-1 whitespace-pre-line text-foreground/80">{r.response}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
              <Pagination page={page} total={total} pageSize={SIZE} href={(p) => buildHref("/reviews", { stars: sp.stars, page: p })} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
