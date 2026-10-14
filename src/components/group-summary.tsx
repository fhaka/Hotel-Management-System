import Image from "next/image";
import { Building2 } from "lucide-react";
import { ReservationStatusBadge } from "@/components/status";
import { formatLongDate, nightsBetween } from "@/lib/dates";
import { formatMoney, pluralize } from "@/lib/format";
import { summarizeGroup, type FullGroup } from "@/lib/reservations";
import type { HotelConfig } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Guest-facing summary of a multi-room booking and its combined bill. */
export function GroupSummary({ g, hotel, className }: { g: FullGroup; hotel: HotelConfig; className?: string }) {
  const folio = summarizeGroup(g);
  const first = g.reservations[0]!;
  const nights = nightsBetween(first.checkIn, first.checkOut);
  const active = g.reservations.filter((r) => r.status !== "CANCELLED");

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-white", className)}>
      <div className="border-b border-border p-6">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Check-in</p>
            <p className="mt-0.5 font-medium">{formatLongDate(first.checkIn)}</p>
            <p className="text-xs text-muted-foreground">from {hotel.checkInTime}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Check-out</p>
            <p className="mt-0.5 font-medium">{formatLongDate(first.checkOut)}</p>
            <p className="text-xs text-muted-foreground">until {hotel.checkOutTime}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Booking</p>
            <p className="mt-0.5 font-medium">{pluralize(active.length, "room")} · {pluralize(nights, "night")}</p>
            <p className="text-xs text-muted-foreground">{pluralize(active.reduce((s, r) => s + r.adults + r.children, 0), "guest")}</p>
          </div>
        </div>
        {g.company && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <Building2 className="size-4 text-gold" /> Invoiced to <span className="font-medium text-foreground">{g.company.name}</span>
            {g.company.taxId && <span>· NIPT {g.company.taxId}</span>}
          </p>
        )}
      </div>
      <ul className="divide-y divide-border">
        {g.reservations.map((r, i) => (
          <li key={r.id} className={cn("flex items-center gap-4 px-6 py-4", r.status === "CANCELLED" && "opacity-60")}>
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
              <Image src={r.roomType.images[0]!} alt={r.roomType.name} fill sizes="80px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="text-muted-foreground">Room {i + 1} · </span>
                {r.roomType.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.occupantName ? `${r.occupantName} · ` : ""}
                {pluralize(r.adults, "adult")}
                {r.children ? `, ${pluralize(r.children, "child", "children")}` : ""} · <span className="font-mono">{r.code}</span>
              </p>
            </div>
            <ReservationStatusBadge status={r.status} />
          </li>
        ))}
      </ul>
      {g.reservations[0]?.specialRequests && (
        <p className="mx-6 mb-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Your requests: </span>
          {g.reservations[0].specialRequests}
        </p>
      )}
      <div className="border-t border-border p-6">
        <p className="text-sm font-medium">{g.singleBill ? "Your bill (one bill for all rooms)" : "Your bill"}</p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between font-semibold">
            <dt>Total (incl. {formatMoney(folio.vat)} VAT)</dt>
            <dd>{formatMoney(folio.total)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Paid</dt>
            <dd>{formatMoney(folio.paid)}</dd>
          </div>
          {folio.refunded > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Refunded to your card</dt>
              <dd>−{formatMoney(folio.refunded)}</dd>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <dt>{folio.balance < 0 ? "Credit" : "Balance due"}</dt>
            <dd className={folio.balance > 0 ? "text-warning" : "text-success"}>{formatMoney(Math.abs(folio.balance))}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
