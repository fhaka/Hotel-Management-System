"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/rooms", label: "Rooms & Suites" },
  { href: "/experiences", label: "Dining & Spa" },
  { href: "/manage-booking", label: "Manage booking" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ account }: { account: { href: string; label: string } | null }) {
  const pathname = usePathname();
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const light = overlay && !scrolled && !open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        light ? "bg-transparent" : "border-b border-border bg-white/95 shadow-[0_1px_12px_rgba(15,26,46,0.05)] backdrop-blur",
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Logo tone={light ? "light" : "dark"} />
        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "text-[0.8rem] font-medium uppercase tracking-[0.14em] transition-colors",
                light ? "text-white/85 hover:text-white" : "text-foreground/75 hover:text-primary",
                pathname.startsWith(l.href) && (light ? "text-white" : "text-primary"),
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={account?.href ?? "/login"}
            className={cn(
              "hidden items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors sm:flex",
              light ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-foreground/75 hover:bg-muted hover:text-primary",
            )}
          >
            <UserRound className="size-4" /> {account?.label ?? "Sign in"}
          </Link>
          <ButtonLink href="/book" variant={light ? "light" : "default"} size="md" className="hidden sm:inline-flex">
            Book your stay
          </ButtonLink>
          <button
            onClick={() => setOpenOn(open ? null : pathname)}
            className={cn("rounded-md p-2 lg:hidden", light ? "text-white" : "text-foreground")}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-white px-5 pb-6 pt-2 lg:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block border-b border-border py-3 text-sm font-medium uppercase tracking-[0.12em] text-foreground/80">
              {l.label}
            </Link>
          ))}
          <Link href={account?.href ?? "/login"} className="block border-b border-border py-3 text-sm font-medium uppercase tracking-[0.12em] text-foreground/80">
            {account?.label ?? "Sign in"}
          </Link>
          <ButtonLink href="/book" className="mt-4 w-full" size="lg">
            Book your stay
          </ButtonLink>
        </div>
      )}
    </header>
  );
}
