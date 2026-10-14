"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", label: "My bookings" },
  { href: "/account/profile", label: "Profile & security" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-8 flex gap-6 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors",
            pathname === t.href ? "border-gold text-primary" : "border-transparent text-muted-foreground hover:text-primary",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
