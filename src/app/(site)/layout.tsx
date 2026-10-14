import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/dal";
import { isStaff } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "./site-header";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, hotel] = await Promise.all([getCurrentUser(), getSettings()]);
  const account = user
    ? isStaff(user.role)
      ? { href: "/admin", label: "Operations" }
      : { href: "/account", label: user.name.split(" ")[0]! }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader account={account} />
      <main className="flex-1">{children}</main>
      <footer className="bg-primary text-white/70">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo tone="light" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              A landmark of Albanian hospitality since 1938, set between Skanderbeg Square and the leafy Blloku district.
            </p>
          </div>
          <div>
            <p className="eyebrow !text-gold-light">Visit</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold-light" />
                <span>
                  {hotel.address}
                  <br />
                  {hotel.city}, {hotel.country}
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-gold-light" />
                <a href={`tel:${hotel.phone.replace(/\s/g, "")}`} className="hover:text-white">
                  {hotel.phone}
                </a>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-gold-light" />
                <a href={`mailto:${hotel.email}`} className="hover:text-white">
                  {hotel.email}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow !text-gold-light">Explore</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/rooms" className="hover:text-white">Rooms & Suites</Link></li>
              <li><Link href="/experiences" className="hover:text-white">Saffron Restaurant</Link></li>
              <li><Link href="/experiences#spa" className="hover:text-white">Imperial Spa</Link></li>
              <li><Link href="/book" className="hover:text-white">Check availability</Link></li>
              <li><Link href="/manage-booking" className="hover:text-white">Manage your booking</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow !text-gold-light">Good to know</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>Check-in from {hotel.checkInTime}</li>
              <li>Check-out until {hotel.checkOutTime}</li>
              <li>Free cancellation up to {hotel.freeCancellationHours}h before arrival</li>
              <li>Best rate guaranteed when booking direct</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs sm:flex-row sm:px-8">
            <p>© {new Date().getFullYear()} {hotel.legalName} All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/contact" className="hover:text-white">Contact</Link>
              <Link href="/login" className="hover:text-white">Staff login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
