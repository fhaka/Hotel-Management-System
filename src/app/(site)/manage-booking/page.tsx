import type { Metadata } from "next";
import { Download, Search } from "lucide-react";
import { BookingSummary } from "@/components/booking-summary";
import { GroupSummary } from "@/components/group-summary";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/lib/db";
import { canGuestView, canGuestViewGroup, isGroupCode } from "@/lib/guest-access";
import { cancellationTerms, getGroup, reservationInclude, type FullGroup, type FullReservation } from "@/lib/reservations";
import { getSettings } from "@/lib/settings";
import { CancelBooking, LookupForm } from "./forms";

export const metadata: Metadata = { title: "Manage your booking" };

/** Resolves a code to what the guest should see: a whole group (also for a room code inside one) or one reservation. */
async function resolve(code: string): Promise<{ group: FullGroup } | { reservation: FullReservation } | null> {
  if (isGroupCode(code)) {
    const g = await getGroup({ code });
    return g && (await canGuestViewGroup(g)) ? { group: g } : null;
  }
  const r = await db.reservation.findUnique({ where: { code }, include: reservationInclude });
  if (!r || !(await canGuestView(r))) return null;
  if (r.group) {
    const g = await getGroup({ id: r.group.id });
    if (g) return { group: g };
  }
  return { reservation: r };
}

export default async function ManageBookingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const hotel = await getSettings();
  const found = code ? await resolve(code.toUpperCase()) : null;

  if (!found) {
    return (
      <div className="bg-ivory pb-24 pt-32">
        <div className="mx-auto max-w-lg px-5">
          <div className="text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-soft">
              <Search className="size-6 text-gold" />
            </span>
            <h1 className="mt-5 font-serif text-4xl text-primary">Manage your booking</h1>
            <p className="mt-2 text-muted-foreground">Enter your confirmation number and the email address you booked with.</p>
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-white p-6">
            <LookupForm defaultCode={code} />
          </div>
        </div>
      </div>
    );
  }

  const g = "group" in found ? found.group : null;
  const r = "reservation" in found ? found.reservation : null;
  const upcoming = g ? g.reservations.filter((x) => x.status === "CONFIRMED" || x.status === "PENDING") : r && (r.status === "CONFIRMED" || r.status === "PENDING") ? [r] : [];
  const cancellable = upcoming.length > 0;
  const terms = cancellable ? await cancellationTerms(upcoming[0]!, hotel) : null;
  const ref = g?.code ?? r!.code;
  const person = g?.booker ?? r!.guest;
  const invoice = g ? (g.singleBill ? g.invoice : null) : r!.invoice;

  return (
    <div className="bg-ivory pb-24 pt-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <p className="eyebrow">{g ? `Group booking ${g.code}` : `Reservation ${ref}`}</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">
          {person.firstName} {person.lastName}
        </h1>
        {g ? <GroupSummary g={g} hotel={hotel} className="mt-8" /> : <BookingSummary r={r!} hotel={hotel} className="mt-8" />}
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/api/invoices/${ref}`} variant="outline" prefetch={false}>
            <Download /> {invoice ? `Download invoice ${invoice.number}` : "Download pro-forma invoice"}
          </ButtonLink>
          {cancellable && terms && <CancelBooking code={ref} free={terms.free} hours={terms.deadlineHours} rooms={upcoming.length} />}
        </div>
        {cancellable && terms && (
          <p className="mt-4 text-sm text-muted-foreground">
            {terms.free
              ? `Free cancellation is available until ${hotel.freeCancellationHours} hours before arrival.`
              : `The free cancellation window has passed — cancelling now incurs a charge of the first night${upcoming.length > 1 ? " for each room" : ""}.`}
          </p>
        )}
      </div>
    </div>
  );
}
