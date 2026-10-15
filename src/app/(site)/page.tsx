import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BedDouble, Car, Dumbbell, Quote, Sparkles, Star, UtensilsCrossed, Wifi } from "lucide-react";
import { BookingBar } from "@/components/booking-bar";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

const IMG = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export default async function HomePage() {
  const [roomTypes, reviews, rating] = await Promise.all([
    db.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.review.findMany({ where: { status: "PUBLISHED", rating: { gte: 4 } }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.review.aggregate({ where: { status: "PUBLISHED" }, _avg: { rating: true }, _count: true }),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[92vh] items-end overflow-hidden bg-primary pb-16 pt-32">
        <Image src={IMG("1564501049412-61c2a3083791", 2400)} alt="Hotel Imperial courtyard pool at dusk" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/30 to-primary/85" />
        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl animate-fade-up">
            <p className="eyebrow !text-gold-light">Five-star hotel · Tirana, Albania</p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              Timeless elegance in the heart of the city.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              Sixty rooms and suites, a destination spa and Saffron — our celebrated restaurant. Steps from Skanderbeg Square.
            </p>
          </div>
          <div className="mt-12 max-w-5xl animate-fade-up [animation-delay:150ms]">
            <BookingBar today={todayISO()} />
            <p className="mt-3 text-sm text-white/70">
              <Award className="mr-1.5 inline size-4 text-gold-light" />
              Best rate guaranteed when you book direct · Free cancellation up to 48h
            </p>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-ivory py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Welcome to the Imperial</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight text-primary sm:text-5xl">An address with a story, a stay to remember.</h2>
            <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground">
              Since 1938, Hotel Imperial has welcomed diplomats, artists and travellers to Tirana. Today our restored landmark pairs
              its heritage façade with contemporary rooms, warm Albanian hospitality and service that anticipates every need.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-8">
              {[
                ["60", "Rooms & suites"],
                [rating._avg.rating ? rating._avg.rating.toFixed(1) : "4.9", "Guest rating"],
                ["24/7", "Concierge"],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-serif text-4xl text-primary">{n}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative grid grid-cols-2 gap-4">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
              <Image src={IMG("1621293954908-907159247fc8", 900)} alt="Imperial Suite living room" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" />
            </div>
            <div className="relative mt-12 aspect-[3/4] overflow-hidden rounded-2xl">
              <Image src={IMG("1590381105924-c72589b9ef3f", 900)} alt="The Imperial Lounge bar" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Rooms & Suites</p>
              <h2 className="mt-4 font-serif text-4xl text-primary sm:text-5xl">Rest, beautifully.</h2>
            </div>
            <ButtonLink href="/rooms" variant="outline">
              All rooms <ArrowRight />
            </ButtonLink>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {roomTypes.map((rt) => (
              <Link key={rt.id} href={`/rooms/${rt.slug}`} className="group">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                  <Image src={rt.images[0]!} alt={rt.name} fill sizes="(min-width:1280px) 25vw, (min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-gold-light">{rt.sizeSqm} m² · {rt.view}</p>
                    <h3 className="mt-2 font-serif text-2xl">{rt.name}</h3>
                    <p className="mt-1 text-sm text-white/75">From {formatMoney(rt.baseRate, { compact: true })} / night</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Experiences */}
      <section className="bg-primary py-24 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <p className="eyebrow !text-gold-light">Experiences</p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl sm:text-5xl">Savour, unwind, celebrate.</h2>
          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {[
              { title: "Saffron Restaurant", text: "Modern Albanian cuisine from seasonal, local produce — with a terrace overlooking the gardens.", img: "1517248135467-4c7edcad34c4", href: "/experiences#dining", icon: UtensilsCrossed },
              { title: "The Imperial Spa", text: "Indoor pool, sauna, hammam and six treatment rooms for signature massages and facials.", img: "1544161515-4ab6ce6db874", href: "/experiences#spa", icon: Sparkles },
              { title: "Imperial Lounge", text: "Classic cocktails, rare rakia and live jazz on Friday evenings in our art-deco bar.", img: "1590381105924-c72589b9ef3f", href: "/experiences#lounge", icon: Star },
            ].map((x) => (
              <Link key={x.title} href={x.href} className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image src={IMG(x.img, 1000)} alt={x.title} fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <x.icon className="size-5 text-gold-light" />
                  <h3 className="font-serif text-2xl">{x.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{x.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="border-b border-border bg-ivory py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 sm:px-8 md:grid-cols-3 lg:grid-cols-6">
          {[
            [Wifi, "Fast Wi-Fi throughout"],
            [UtensilsCrossed, "Breakfast buffet"],
            [Sparkles, "Spa & indoor pool"],
            [Dumbbell, "24h fitness studio"],
            [Car, "Valet parking"],
            [BedDouble, "Premium bedding"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Wifi;
            return (
              <div key={label as string} className="flex flex-col items-center text-center">
                <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 text-gold">
                  <I className="size-5" />
                </span>
                <p className="mt-3 text-sm text-foreground/80">{label as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reviews */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center">
            <p className="eyebrow">Guest stories</p>
            <h2 className="mt-4 font-serif text-4xl text-primary sm:text-5xl">Loved by our guests</h2>
            <p className="mt-3 text-muted-foreground">
              Rated {rating._avg.rating?.toFixed(1)} out of 5 from {rating._count} verified reviews ·{" "}
              <Link href="/reviews" className="font-medium text-primary underline-offset-4 hover:underline">Read all reviews</Link>
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="flex flex-col rounded-2xl border border-border bg-white p-8">
                <Quote className="size-7 text-gold/60" />
                <div className="mt-4 flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={i < r.rating ? "size-4 fill-gold text-gold" : "size-4 text-border"} />
                  ))}
                </div>
                <p className="mt-3 font-serif text-xl text-primary">{r.title}</p>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{r.body}</blockquote>
                <figcaption className="mt-6 text-sm font-medium text-foreground">
                  {r.guestName} <span className="font-normal text-muted-foreground">· {r.country}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-primary py-24">
        <Image src={IMG("1606402179428-a57976d71fa4", 2000)} alt="" fill sizes="100vw" className="object-cover opacity-30" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <p className="eyebrow !text-gold-light">Your stay awaits</p>
          <h2 className="mt-4 font-serif text-4xl text-white sm:text-5xl">Reserve directly for our best rates and exclusive perks.</h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/book" variant="gold" size="lg">
              Book your stay
            </ButtonLink>
            <ButtonLink href="/contact" variant="light" size="lg">
              Contact us
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
