import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, Clock, LinkIcon } from "lucide-react";
import { Stars } from "@/components/stars";
import { ButtonLink } from "@/components/ui/button";
import { formatLongDate, nightsBetween } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import { publicName, reviewableStay, verifyReviewToken } from "@/lib/reviews";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Review your stay", robots: { index: false } };

function Notice({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-white p-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-soft text-gold [&_svg]:size-6">{icon}</span>
      <h1 className="mt-5 font-serif text-3xl text-primary">{title}</h1>
      <p className="mt-2 text-muted-foreground">{text}</p>
      <ButtonLink href="/reviews" variant="outline" className="mt-6">Read guest reviews</ButtonLink>
    </div>
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reservationId = await verifyReviewToken(token);
  const stay = reservationId ? await reviewableStay(reservationId) : { state: "missing" as const };

  return (
    <div className="min-h-[70vh] bg-ivory pb-24 pt-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {stay.state === "missing" ? (
          <Notice icon={<LinkIcon />} title="This link has expired" text="Review links are valid for 90 days. If you'd still like to share feedback, please write to us through the contact page." />
        ) : stay.state === "not-yet" ? (
          <Notice icon={<Clock />} title="Almost there" text="You'll be able to review your stay after check-out. We hope you're enjoying your time with us!" />
        ) : stay.state === "done" ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-white p-10 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft"><CheckCircle2 className="size-7 text-success" /></span>
            <h1 className="mt-5 font-serif text-3xl text-primary">Thank you for your review</h1>
            <div className="mt-4"><Stars value={stay.r.review!.rating} size="lg" /></div>
            <p className="mt-2 font-medium">“{stay.r.review!.title}”</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {stay.r.review!.status === "PUBLISHED" ? "Your review is live on our website." : "Our team will publish it shortly."}
            </p>
            <ButtonLink href="/reviews" variant="outline" className="mt-6">Read guest reviews</ButtonLink>
          </div>
        ) : (
          <>
            <p className="eyebrow">Guest review</p>
            <h1 className="mt-3 font-serif text-4xl text-primary sm:text-5xl">How was your stay, {stay.r.guest.firstName}?</h1>
            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                <Image src={stay.r.roomType.images[0]!} alt={stay.r.roomType.name} fill sizes="96px" className="object-cover" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{stay.r.group?.name ?? stay.r.roomType.name}</p>
                <p className="text-muted-foreground">
                  {formatLongDate(stay.r.checkIn)} – {formatLongDate(stay.r.checkOut)} · {pluralize(nightsBetween(stay.r.checkIn, stay.r.checkOut), "night")}
                </p>
              </div>
            </div>
            <ReviewForm token={token} defaults={{ guestName: publicName(stay.r.guest.firstName, stay.r.guest.lastName), country: stay.r.guest.country ?? "" }} />
          </>
        )}
      </div>
    </div>
  );
}
