"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function BookingBar({
  today,
  initial,
  variant = "floating",
}: {
  today: string;
  initial?: { checkIn?: string; checkOut?: string; adults?: number; children?: number };
  variant?: "floating" | "inline";
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? addDays(today, 7));
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? addDays(today, 10));
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [children, setChildren] = useState(initial?.children ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ checkIn, checkOut, adults: String(adults), children: String(children) });
    router.push(`/book?${params}`);
  }

  const label = "flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
  const input = "mt-1 w-full bg-transparent text-[15px] font-medium text-foreground outline-none cursor-pointer";

  return (
    <form
      onSubmit={submit}
      className={cn(
        "grid gap-px overflow-hidden rounded-xl bg-border md:grid-cols-[1fr_1fr_1fr_auto]",
        variant === "floating" ? "shadow-2xl shadow-primary/20" : "border border-border",
      )}
    >
      <label className="bg-white px-5 py-3.5">
        <span className={label}><CalendarDays className="size-3.5 text-gold" /> Check-in</span>
        <input
          type="date"
          required
          min={today}
          value={checkIn}
          onChange={(e) => {
            setCheckIn(e.target.value);
            if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
          }}
          className={input}
        />
      </label>
      <label className="bg-white px-5 py-3.5">
        <span className={label}><CalendarDays className="size-3.5 text-gold" /> Check-out</span>
        <input type="date" required min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={input} />
      </label>
      <div className="flex gap-4 bg-white px-5 py-3.5">
        <label className="flex-1">
          <span className={label}><Users className="size-3.5 text-gold" /> Adults</span>
          <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={input}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex-1">
          <span className={label}>Children</span>
          <select value={children} onChange={(e) => setChildren(Number(e.target.value))} className={input}>
            {[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="bg-white p-2">
        <Button type="submit" size="lg" className="h-full w-full min-h-12 px-8">
          <Search /> Check availability
        </Button>
      </div>
    </form>
  );
}
