import type { Metadata } from "next";
import Image from "next/image";
import { Clock } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Dining & Spa" };

const IMG = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export default async function ExperiencesPage() {
  const services = await db.service.findMany({ where: { active: true, category: { in: ["SPA", "DINING"] } }, orderBy: { price: "asc" } });
  const spa = services.filter((s) => s.category === "SPA");
  const dining = services.filter((s) => s.category === "DINING");

  const sections = [
    {
      id: "dining",
      eyebrow: "Saffron Restaurant",
      title: "Modern Albanian cuisine, rooted in the seasons.",
      text: "Chef Dorian Lika reinterprets the flavours of the Albanian highlands and coast with produce from small local farms. Breakfast is served as a generous buffet; dinner as a three-course seasonal menu or à la carte.",
      hours: ["Breakfast 06:30 – 10:30", "Lunch 12:30 – 15:00", "Dinner 19:00 – 23:00"],
      images: ["1517248135467-4c7edcad34c4", "1414235077428-338989a2e8c0"],
      items: dining,
    },
    {
      id: "spa",
      eyebrow: "The Imperial Spa",
      title: "A sanctuary of calm beneath the city.",
      text: "Our 900 m² spa features a heated indoor pool, Finnish sauna, hammam and six treatment rooms. Junior and Imperial Suite guests enjoy complimentary access.",
      hours: ["Spa & pool 07:00 – 22:00", "Treatments 10:00 – 21:00", "Fitness studio 24 hours"],
      images: ["1544161515-4ab6ce6db874", "1600334089648-b0d9d3028eb2"],
      items: spa,
    },
    {
      id: "lounge",
      eyebrow: "Imperial Lounge",
      title: "Cocktails, rakia and live jazz.",
      text: "Our art-deco bar is Tirana's favourite meeting place — classic cocktails, an extensive list of Albanian wines and rare rakia, with live jazz every Friday evening.",
      hours: ["Daily 11:00 – 01:00", "Live jazz Fridays from 21:00"],
      images: ["1590381105924-c72589b9ef3f", "1559339352-11d035aa65de"],
      items: [],
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Dining & Spa"
        title="Savour every moment."
        text="Award-winning dining, a destination spa and Tirana's most elegant bar — all under one roof."
        image={IMG("1551632436-cbf8dd35adfa", 2400)}
      />
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className={i % 2 ? "scroll-mt-20 bg-ivory py-24" : "scroll-mt-20 py-24"}>
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
            <div className={i % 2 ? "lg:order-2" : ""}>
              <div className="grid grid-cols-5 gap-4">
                <div className="relative col-span-3 aspect-[3/4] overflow-hidden rounded-2xl">
                  <Image src={IMG(s.images[0]!, 900)} alt={s.eyebrow} fill sizes="30vw" className="object-cover" />
                </div>
                <div className="relative col-span-2 mt-16 aspect-[3/4] overflow-hidden rounded-2xl">
                  <Image src={IMG(s.images[1]!, 700)} alt="" fill sizes="20vw" className="object-cover" />
                </div>
              </div>
            </div>
            <div>
              <p className="eyebrow">{s.eyebrow}</p>
              <h2 className="mt-4 font-serif text-4xl leading-tight text-primary">{s.title}</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">{s.text}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {s.hours.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-foreground/80">
                    <Clock className="size-4 text-gold" /> {h}
                  </li>
                ))}
              </ul>
              {s.items.length > 0 && (
                <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-white">
                  {s.items.map((it) => (
                    <div key={it.id} className="flex items-start justify-between gap-4 px-5 py-4">
                      <div>
                        <p className="font-medium">{it.name}</p>
                        {it.description && <p className="mt-0.5 text-sm text-muted-foreground">{it.description}</p>}
                      </div>
                      <p className="whitespace-nowrap font-serif text-lg text-primary">{formatMoney(it.price)}</p>
                    </div>
                  ))}
                </div>
              )}
              <ButtonLink href="/contact" variant="outline" className="mt-8">
                Make a reservation
              </ButtonLink>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
