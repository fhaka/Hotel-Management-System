import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const hotel = await getSettings();
  return (
    <div className="bg-ivory pb-24 pt-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 max-w-2xl font-serif text-5xl text-primary">We&apos;re here to help plan your stay.</h1>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            {[
              [MapPin, "Address", `${hotel.address}, ${hotel.city}, ${hotel.country}`],
              [Phone, "Reservations", hotel.phone],
              [Mail, "Email", hotel.email],
              [Clock, "Front desk", "Open 24 hours, every day"],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof MapPin;
              return (
                <div key={label as string} className="flex gap-4 rounded-2xl border border-border bg-white p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-soft">
                    <I className="size-5 text-gold" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label as string}</p>
                    <p className="mt-1 font-medium">{value as string}</p>
                  </div>
                </div>
              );
            })}
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <iframe
                title="Map of Hotel Imperial"
                className="h-64 w-full"
                loading="lazy"
                src="https://www.openstreetmap.org/export/embed.html?bbox=19.8075%2C41.3225%2C19.8255%2C41.3325&layer=mapnik&marker=41.3275%2C19.8165"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
            <h2 className="font-serif text-3xl text-primary">Send us a message</h2>
            <p className="mt-1 text-sm text-muted-foreground">Our guest relations team replies within one business day.</p>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
