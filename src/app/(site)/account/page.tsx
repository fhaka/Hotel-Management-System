import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { ReservationStatusBadge } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, nightsBetween, today } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "My bookings" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const reservations = user.guest
    ? await db.reservation.findMany({
        where: { guestId: user.guest.id },
        include: { roomType: true, charges: true, payments: true },
        orderBy: { checkIn: "desc" },
      })
    : [];
  const t = today();
  const upcoming = reservations.filter((r) => ["CONFIRMED", "PENDING", "CHECKED_IN"].includes(r.status) && r.checkOut >= t).reverse();
  const past = reservations.filter((r) => !upcoming.includes(r));

  if (reservations.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white">
        <EmptyState
          icon={<CalendarPlus />}
          title="No bookings yet"
          description="When you book a stay with your account, it will appear here."
          action={<ButtonLink href="/book">Book your stay</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-2xl text-primary">Upcoming stays</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No upcoming stays.{" "}
            <Link href="/book" className="font-medium text-primary underline-offset-4 hover:underline">
              Plan your next visit
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-4">{upcoming.map((r) => <BookingCard key={r.id} r={r} />)}</div>
        )}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-primary">Past & cancelled</h2>
          <div className="mt-4 space-y-3">{past.map((r) => <BookingCard key={r.id} r={r} compact />)}</div>
        </section>
      )}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof db.reservation.findMany<{ include: { roomType: true; charges: true; payments: true } }>>>[number];

function BookingCard({ r, compact }: { r: Row; compact?: boolean }) {
  const folio = summarizeFolio(r);
  return (
    <Link
      href={`/manage-booking?code=${r.code}`}
      className="group flex items-center gap-5 overflow-hidden rounded-2xl border border-border bg-white pr-5 transition-shadow hover:shadow-md"
    >
      <div className={compact ? "relative h-20 w-28 shrink-0" : "relative h-32 w-44 shrink-0"}>
        <Image src={r.roomType.images[0]!} alt={r.roomType.name} fill sizes="176px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className={compact ? "font-medium" : "font-serif text-xl text-primary"}>{r.roomType.name}</p>
          <ReservationStatusBadge status={r.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(r.checkIn)} – {formatDate(r.checkOut)} · {pluralize(nightsBetween(r.checkIn, r.checkOut), "night")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Confirmation <span className="font-mono">{r.code}</span> · Total {formatMoney(folio.total)}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
