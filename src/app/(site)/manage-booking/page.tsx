import type { Metadata } from "next";
import { Download, Search } from "lucide-react";
import { BookingSummary } from "@/components/booking-summary";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/lib/db";
import { canGuestView } from "@/lib/guest-access";
import { cancellationTerms, reservationInclude } from "@/lib/reservations";
import { getSettings } from "@/lib/settings";
import { CancelBooking, LookupForm } from "./forms";

export const metadata: Metadata = { title: "Manage your booking" };

export default async function ManageBookingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const hotel = await getSettings();
  const r = code ? await db.reservation.findUnique({ where: { code: code.toUpperCase() }, include: reservationInclude }) : null;
  const visible = r && (await canGuestView(r));

  if (!r || !visible) {
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

  const cancellable = r.status === "CONFIRMED" || r.status === "PENDING";
  const terms = await cancellationTerms(r, hotel);

  return (
    <div className="bg-ivory pb-24 pt-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <p className="eyebrow">Reservation {r.code}</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">
          {r.guest.firstName} {r.guest.lastName}
        </h1>
        <BookingSummary r={r} hotel={hotel} className="mt-8" />
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/api/invoices/${r.code}`} variant="outline" prefetch={false}>
            <Download /> {r.invoice ? `Download invoice ${r.invoice.number}` : "Download pro-forma invoice"}
          </ButtonLink>
          {cancellable && <CancelBooking code={r.code} free={terms.free} hours={terms.deadlineHours} />}
        </div>
        {cancellable && (
          <p className="mt-4 text-sm text-muted-foreground">
            {terms.free
              ? `Free cancellation is available until ${hotel.freeCancellationHours} hours before arrival.`
              : "The free cancellation window has passed — cancelling now incurs a charge of the first night."}
          </p>
        )}
      </div>
    </div>
  );
}
