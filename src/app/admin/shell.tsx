"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  BookOpenCheck,
  Building2,
  CalendarRange,
  ChartColumnBig,
  ConciergeBell,
  ExternalLink,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Star,
  UserCog,
  Users,
  Wine,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./nav";

const ICONS = { BedDouble, BookOpenCheck, Building2, CalendarRange, ChartColumnBig, ConciergeBell, History, Inbox, LayoutDashboard, Receipt, Settings, Sparkles, Star, UserCog, Users, Wine };

type ShellUser = { name: string; email: string; roleLabel: string };

export function AdminShell({
  nav,
  user,
  badges,
  logoutAction,
  children,
}: {
  nav: NavGroup[];
  user: ShellUser;
  badges: Record<string, number>;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const sidebar = (
    <div className="flex h-full flex-col bg-primary text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo href="/admin" tone="light" />
        <button className="rounded-md p-1 text-white/70 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {nav.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/40">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon as keyof typeof ICONS];
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                const badge = badges[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-gold-light" : "text-white/50 group-hover:text-white/80")} />
                      <span className="flex-1">{item.label}</span>
                      {badge ? <span className="rounded-full bg-gold px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none text-white">{badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-4 text-white/50" /> View website
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-primary/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 outline-none hover:bg-muted">
                <Avatar name={user.name} className="size-8" />
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-tight">{user.name}</span>
                  <span className="block text-xs text-muted-foreground">{user.roleLabel}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" target="_blank">
                    <ExternalLink /> View website
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void logoutAction()}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search guests, bookings, rooms…"
        className="h-9 w-full rounded-lg border border-transparent bg-muted pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-gold/50 focus:bg-white"
      />
    </form>
  );
}
