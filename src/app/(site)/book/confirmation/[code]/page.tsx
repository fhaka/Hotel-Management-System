import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck2, CheckCircle2, Mail } from "lucide-react";
import { Steps } from "@/components/booking-steps";
import { ButtonLink } from "@/components/ui/button";
import { canGuestView } from "@/lib/guest-access";
import { db } from "@/lib/db";
import { reservationInclude } from "@/lib/reservations";
import { getSettings } from "@/lib/settings";
import { BookingSummary } from "@/components/booking-summary";

export const metadata: Metadata = { title: "Reservation confirmed" };

export default async function ConfirmationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [r, hotel] = await Promise.all([db.reservation.findUnique({ where: { code }, include: reservationInclude }), getSettings()]);
  if (!r) notFound();
  if (!(await canGuestView(r))) notFound();

  return (
    <div className="bg-ivory pb-24 pt-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <Steps current={3} />
        <div className="mt-10 rounded-2xl border border-border bg-white p-8 text-center sm:p-12">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft">
            <CheckCircle2 className="size-8 text-success" />
          </span>
          <p className="eyebrow mt-6">Reservation confirmed</p>
          <h1 className="mt-3 font-serif text-4xl text-primary">Thank you, {r.guest.firstName}.</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            We look forward to welcoming you to Hotel Imperial. A confirmation has been sent to{" "}
            <span className="font-medium text-foreground">{r.guest.email}</span>.
          </p>
          <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-xl border border-dashed border-gold/50 bg-gold-soft/40 px-8 py-4">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Confirmation number</span>
            <span className="mt-1 font-mono text-2xl font-semibold tracking-widest text-primary">{r.code}</span>
          </div>
        </div>

        <BookingSummary r={r} hotel={hotel} className="mt-6" />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex gap-4 rounded-2xl border border-border bg-white p-6">
            <CalendarCheck2 className="size-6 shrink-0 text-gold" />
            <div>
              <p className="font-medium">Manage your booking</p>
              <p className="mt-1 text-sm text-muted-foreground">View, download your invoice or cancel anytime with your confirmation number and email.</p>
              <ButtonLink href={`/manage-booking?code=${r.code}`} variant="outline" size="sm" className="mt-3">
                Manage booking
              </ButtonLink>
            </div>
          </div>
          <div className="flex gap-4 rounded-2xl border border-border bg-white p-6">
            <Mail className="size-6 shrink-0 text-gold" />
            <div>
              <p className="font-medium">Questions before you arrive?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Our concierge is available 24/7 at {hotel.phone} or {hotel.email}.
              </p>
              <ButtonLink href="/experiences" variant="outline" size="sm" className="mt-3">
                Explore dining & spa
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
