import Image from "next/image";
import { formatLongDate, nightsBetween } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney, pluralize, toNumber } from "@/lib/format";
import type { FullReservation } from "@/lib/reservations";
import type { HotelConfig } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { ReservationStatusBadge } from "@/components/status";

/** Guest-facing summary of a reservation and its bill. */
export function BookingSummary({ r, hotel, className }: { r: FullReservation; hotel: HotelConfig; className?: string }) {
  const folio = summarizeFolio(r);
  const charges = r.charges.filter((c) => !c.voided);
  const nights = nightsBetween(r.checkIn, r.checkOut);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-white", className)}>
      <div className="grid sm:grid-cols-[240px_1fr]">
        <div className="relative aspect-[16/10] sm:aspect-auto">
          <Image src={r.roomType.images[0]!} alt={r.roomType.name} fill sizes="240px" className="object-cover" />
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-serif text-2xl text-primary">{r.roomType.name}</p>
            <ReservationStatusBadge status={r.status} />
          </div>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Check-in</p>
              <p className="mt-0.5 font-medium">{formatLongDate(r.checkIn)}</p>
              <p className="text-xs text-muted-foreground">from {hotel.checkInTime}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Check-out</p>
              <p className="mt-0.5 font-medium">{formatLongDate(r.checkOut)}</p>
              <p className="text-xs text-muted-foreground">until {hotel.checkOutTime}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Guests</p>
              <p className="mt-0.5 font-medium">
                {pluralize(r.adults, "adult")}
                {r.children ? `, ${pluralize(r.children, "child", "children")}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{pluralize(nights, "night")}</p>
            </div>
          </div>
          {r.specialRequests && (
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Your requests: </span>
              {r.specialRequests}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-border p-6">
        <p className="text-sm font-medium">Your bill</p>
        <dl className="mt-3 space-y-1.5 text-sm">
          {groupCharges(charges).map((c) => (
            <div key={c.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{c.label}</dt>
              <dd>{formatMoney(c.amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
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

function groupCharges(charges: FullReservation["charges"]) {
  const groups = new Map<string, number>();
  for (const c of charges) {
    const label = c.type === "ROOM" ? `Room (${charges.filter((x) => x.type === "ROOM").length} nights)` : c.quantity > 1 ? `${c.description} × ${c.quantity}` : c.description;
    groups.set(label, (groups.get(label) ?? 0) + toNumber(c.amount));
  }
  return [...groups].map(([label, amount]) => ({ label, amount }));
}
