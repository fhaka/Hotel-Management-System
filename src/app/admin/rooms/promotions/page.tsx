import type { Metadata } from "next";
import { Pause, Play, Tag } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { promoLabel } from "@/lib/booking-rules";
import { db } from "@/lib/db";
import { formatDate, toISODate, today } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/format";
import { togglePromoAction } from "../pricing-actions";
import { PromoDialog } from "../pricing-dialogs";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  await requireStaff("manageRooms");
  const t = today();
  const [promos, roomTypes, usage] = await Promise.all([
    db.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    db.roomType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.$queryRaw<{ code: string; bookings: bigint; discount: string | null }[]>`
      SELECT r."promoCode" AS code, count(DISTINCT coalesce(r."groupId", r.id)) AS bookings,
             -sum(c.amount) FILTER (WHERE c.type = 'DISCOUNT' AND NOT c.voided AND c.description LIKE 'Promo %') AS discount
        FROM "Reservation" r LEFT JOIN "FolioCharge" c ON c."reservationId" = r.id
       WHERE r."promoCode" IS NOT NULL AND r.status <> 'CANCELLED'
       GROUP BY r."promoCode"`,
  ]);
  const typeName = (id: string) => roomTypes.find((r) => r.id === id)?.name ?? "—";
  const iso = (d: Date | null) => (d ? toISODate(d) : "");

  return (
    <Card>
      <CardHeader title="Promo codes" description="Guests enter codes at checkout; staff can apply them to phone and walk-in bookings." action={<PromoDialog roomTypes={roomTypes} />} />
      {promos.length === 0 ? (
        <EmptyState icon={<Tag />} title="No promo codes yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Offer</Th>
              <Th>Conditions</Th>
              <Th className="text-right">Used</Th>
              <Th className="text-right">Discount given</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => {
              const value = toNumber(p.value);
              const expired = p.validTo && p.validTo < t;
              const exhausted = p.maxUses != null && p.usedCount >= p.maxUses;
              const u = usage.find((x) => x.code === p.code);
              const conditions = [
                p.validFrom || p.validTo ? `Book ${p.validFrom ? `from ${formatDate(p.validFrom)}` : ""}${p.validTo ? ` until ${formatDate(p.validTo)}` : ""}` : null,
                p.stayFrom || p.stayTo ? `Arrive ${p.stayFrom ? formatDate(p.stayFrom) : "now"} – ${p.stayTo ? formatDate(p.stayTo) : "any time"}` : null,
                p.minNights > 1 ? `Min. ${p.minNights} nights` : null,
                p.roomTypeIds.length ? p.roomTypeIds.map(typeName).join(", ") : "All rooms",
              ].filter(Boolean);
              return (
                <tr key={p.id} className={p.active && !expired && !exhausted ? "" : "opacity-60"}>
                  <Td>
                    <span className="rounded-md bg-gold-soft px-2 py-1 font-mono text-xs font-semibold text-[#7a5d2c]">{p.code}</span>
                    <p className="mt-1 max-w-48 text-xs text-muted-foreground">{p.description}</p>
                  </Td>
                  <Td className="font-medium">{promoLabel({ type: p.type, value })}</Td>
                  <Td className="text-xs text-muted-foreground">{conditions.map((c) => <p key={c}>{c}</p>)}</Td>
                  <Td className="text-right tabular-nums">
                    {p.usedCount}
                    {p.maxUses != null && <span className="text-muted-foreground"> / {p.maxUses}</span>}
                    <p className="text-xs text-muted-foreground">{Number(u?.bookings ?? 0)} active bookings</p>
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(Number(u?.discount ?? 0))}</Td>
                  <Td>
                    {!p.active ? <Badge>Paused</Badge> : expired ? <Badge tone="neutral">Expired</Badge> : exhausted ? <Badge tone="warning">Fully used</Badge> : <Badge tone="success" dot>Live</Badge>}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <ActionButton size="icon-sm" variant="ghost" action={togglePromoAction.bind(null, p.id, !p.active)} aria-label={p.active ? `Pause ${p.code}` : `Activate ${p.code}`}>
                        {p.active ? <Pause /> : <Play />}
                      </ActionButton>
                      <PromoDialog
                        id={p.id}
                        roomTypes={roomTypes}
                        values={{ code: p.code, description: p.description, type: p.type, value, validFrom: iso(p.validFrom), validTo: iso(p.validTo), stayFrom: iso(p.stayFrom), stayTo: iso(p.stayTo), minNights: p.minNights, maxUses: p.maxUses, roomTypeIds: p.roomTypeIds, active: p.active }}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
