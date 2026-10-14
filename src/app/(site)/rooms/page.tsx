import type { Metadata } from "next";
import Image from "next/image";
import { BedDouble, Check, Maximize2, Mountain, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/page-hero";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Rooms & Suites" };

export default async function RoomsPage() {
  const roomTypes = await db.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHero
        eyebrow="Rooms & Suites"
        title="Spaces designed for deep rest."
        text="From our serene Classic Rooms to the top-floor Imperial Suite, every room pairs heritage craftsmanship with modern comfort."
        image="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=2400&q=80"
      />
      <section className="py-20">
        <div className="mx-auto max-w-7xl space-y-24 px-5 sm:px-8">
          {roomTypes.map((rt, i) => (
            <article key={rt.id} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image src={rt.images[0]!} alt={rt.name} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {rt.images.slice(1, 3).map((src) => (
                    <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl">
                      <Image src={src} alt="" fill sizes="25vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow">{rt.tagline}</p>
                <h2 className="mt-3 font-serif text-4xl text-primary">{rt.name}</h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">{rt.description}</p>
                <div className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-5 text-sm sm:grid-cols-4">
                  <Spec icon={<Maximize2 />} label={`${rt.sizeSqm} m²`} />
                  <Spec icon={<BedDouble />} label={rt.bedType} />
                  <Spec icon={<Users />} label={`Up to ${rt.maxAdults + rt.maxChildren} guests`} />
                  <Spec icon={<Mountain />} label={rt.view} />
                </div>
                <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
                  {rt.amenities.slice(0, 6).map((a) => (
                    <li key={a} className="flex items-center gap-2 text-foreground/80">
                      <Check className="size-4 text-gold" /> {a}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <p className="mr-4">
                    <span className="text-sm text-muted-foreground">From </span>
                    <span className="font-serif text-3xl text-primary">{formatMoney(rt.baseRate, { compact: true })}</span>
                    <span className="text-sm text-muted-foreground"> / night</span>
                  </p>
                  <ButtonLink href={`/book?roomType=${rt.slug}`}>Book now</ButtonLink>
                  <ButtonLink href={`/rooms/${rt.slug}`} variant="outline">
                    Room details
                  </ButtonLink>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-foreground/80 [&_svg]:size-4 [&_svg]:text-gold">
      {icon} {label}
    </div>
  );
}
