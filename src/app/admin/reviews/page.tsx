import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, EyeOff, MessageSquareQuote, RotateCcw, Star } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { PageHeader, StatCard } from "@/components/page-header";
import { Pagination, buildHref, pageParam } from "@/components/pagination";
import { Stars } from "@/components/stars";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addDays, formatDate, formatDateTime, today } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { CATEGORY_LABELS, reviewStats } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { setReviewStatusAction } from "./actions";
import { ReplyDialog } from "./reply-dialog";
import type { ReviewStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Reviews" };

const SIZE = 15;
const TABS: { key: ReviewStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "PUBLISHED", label: "Published" },
  { key: "HIDDEN", label: "Hidden" },
  { key: "ALL", label: "All" },
];

export default async function ReviewsAdminPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireStaff("reviews");
  const sp = await searchParams;
  const counts = await db.review.groupBy({ by: ["status"], _count: true });
  const count = (s: ReviewStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const tab = (TABS.find((t) => t.key === sp.status)?.key ?? (count("PENDING") > 0 ? "PENDING" : "PUBLISHED")) as ReviewStatus | "ALL";
  const page = pageParam(sp.page);
  const where = tab === "ALL" ? {} : { status: tab };
  const since = addDays(today(), -30);

  const [published, recent, responded, total, reviews] = await Promise.all([
    reviewStats(),
    reviewStats({ createdAt: { gte: since } }),
    db.review.count({ where: { response: { not: null } } }),
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SIZE,
      take: SIZE,
      include: { reservation: { select: { id: true, code: true, checkIn: true, checkOut: true, roomType: { select: { name: true } }, room: { select: { number: true } } } }, respondedBy: { select: { name: true } } },
    }),
  ]);
  const allCount = counts.reduce((s, c) => s + c._count, 0);
  const weakest = published.categories.filter((c) => c.average != null).sort((a, b) => a.average! - b.average!)[0];

  return (
    <>
      <PageHeader
        title="Guest reviews"
        description="Moderate reviews from verified stays, reply publicly and track satisfaction."
        actions={<ButtonLink href="/reviews" target="_blank" variant="outline">View on website</ButtonLink>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average rating" value={<span className="flex items-center gap-2">{published.average.toFixed(2)} <Stars value={published.average} size="md" /></span>} hint={`${published.count} published reviews`} icon={<Star />} accent="gold" />
        <StatCard label="Last 30 days" value={recent.count ? recent.average.toFixed(2) : "—"} hint={`${recent.count} new reviews`} accent="info" />
        <StatCard label="Awaiting moderation" value={count("PENDING")} hint="Not visible on the website yet" accent="warning" />
        <StatCard label="Reply rate" value={formatPercent(allCount ? responded / allCount : 0)} hint={weakest ? `Lowest category: ${weakest.label} (${weakest.average!.toFixed(1)})` : undefined} accent="success" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={buildHref("/admin/reviews", { status: t.key })}
            className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", tab === t.key ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", tab === t.key ? "bg-white/20" : t.key === "PENDING" && count("PENDING") ? "bg-warning-soft text-warning" : "bg-muted")}>
              {t.key === "ALL" ? allCount : count(t.key)}
            </span>
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <Card><EmptyState icon={<MessageSquareQuote />} title={tab === "PENDING" ? "No reviews waiting" : "No reviews here"} description={tab === "PENDING" ? "New guest reviews will appear here for approval." : undefined} /></Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => {
            const categories = (Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).filter((k) => r[k] != null);
            return (
              <Card key={r.id} className={cn(r.status === "HIDDEN" && "opacity-70", r.rating <= 2 && r.status === "PENDING" && "border-danger/30")}>
                <div className="flex flex-col gap-5 p-5 lg:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <Stars value={r.rating} size="md" />
                      <Badge tone={r.status === "PUBLISHED" ? "success" : r.status === "PENDING" ? "warning" : "neutral"}>{r.status === "PUBLISHED" ? "Published" : r.status === "PENDING" ? "Pending" : "Hidden"}</Badge>
                      {r.rating <= 2 && <Badge tone="danger">Low rating — follow up</Badge>}
                      <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                    </div>
                    <p className="mt-2 font-serif text-xl text-primary">{r.title}</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{r.body}</p>
                    {categories.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        {categories.map((k) => (
                          <span key={k} className="flex items-center gap-1.5">{CATEGORY_LABELS[k]} <Stars value={r[k]!} /></span>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-sm">
                      <span className="font-medium">{r.guestName}</span>
                      <span className="text-muted-foreground">
                        {r.country ? ` · ${r.country}` : ""}
                        {r.reservation ? (
                          <>
                            {" · "}
                            <Link href={`/admin/reservations/${r.reservation.id}`} className="font-mono text-xs hover:text-primary hover:underline">{r.reservation.code}</Link>
                            {` · ${r.reservation.roomType.name}${r.reservation.room ? ` ${r.reservation.room.number}` : ""} · ${formatDate(r.reservation.checkIn)} – ${formatDate(r.reservation.checkOut)}`}
                          </>
                        ) : " · imported review"}
                      </span>
                    </p>
                    {r.response && (
                      <div className="mt-3 rounded-lg border-l-4 border-gold bg-gold-soft/40 px-3 py-2 text-sm">
                        <p className="text-xs font-medium text-[#7a5d2c]">Reply by {r.respondedBy?.name ?? "the hotel"}{r.respondedAt ? ` · ${formatDate(r.respondedAt)}` : ""}</p>
                        <p className="mt-1 whitespace-pre-line">{r.response}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-44 lg:flex-col">
                    {r.status !== "PUBLISHED" && (
                      <ActionButton size="sm" action={setReviewStatusAction.bind(null, r.id, "PUBLISHED")}>
                        <CheckCircle2 /> Publish
                      </ActionButton>
                    )}
                    <ReplyDialog id={r.id} guestName={r.guestName} response={r.response ?? ""} published={r.status === "PUBLISHED"} />
                    {r.status !== "HIDDEN" ? (
                      <ActionButton size="sm" variant="outline" action={setReviewStatusAction.bind(null, r.id, "HIDDEN")} confirm="Hide this review from the website?">
                        <EyeOff /> Hide
                      </ActionButton>
                    ) : (
                      <ActionButton size="sm" variant="ghost" action={setReviewStatusAction.bind(null, r.id, "PENDING")}>
                        <RotateCcw /> Back to pending
                      </ActionButton>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Card className="mt-4">
        <Pagination page={page} total={total} pageSize={SIZE} href={(p) => buildHref("/admin/reviews", { status: tab, page: p })} />
      </Card>
    </>
  );
}
