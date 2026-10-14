import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Download, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination, PAGE_SIZE, buildHref, pageParam } from "@/components/pagination";
import { ReservationStatusBadge, SOURCE_LABEL } from "@/components/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, nightsBetween } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney } from "@/lib/format";
import { reservationWhere, type ReservationFilters } from "@/lib/reservation-filters";

export const metadata: Metadata = { title: "Reservations" };

type SP = ReservationFilters & { page?: string };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff("reservations");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const where = reservationWhere(sp);
  const [total, rows, counts] = await Promise.all([
    db.reservation.count({ where }),
    db.reservation.findMany({
      where,
      include: { guest: true, room: true, roomType: true, group: { select: { id: true, code: true } }, company: { select: { name: true } }, charges: { select: { amount: true, vatRate: true, voided: true, type: true } }, payments: { select: { amount: true, kind: true, status: true } } },
      orderBy: sp.dateField === "createdAt" ? { createdAt: "desc" } : [{ checkIn: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.reservation.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const href = (p: Partial<SP>) => buildHref("/admin/reservations", { ...sp, page: undefined, ...p });

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Search, filter and manage every booking."
        actions={
          <>
            <ButtonLink href={buildHref("/api/exports/reservations", { ...sp, page: undefined })} variant="outline" prefetch={false}>
              <Download /> Export CSV
            </ButtonLink>
            <ButtonLink href="/admin/reservations/new">
              <Plus /> New reservation
            </ButtonLink>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={href({ group: sp.group ? undefined : "1" })}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${sp.group ? "border-gold bg-gold text-white" : "border-border bg-white text-foreground hover:bg-muted"}`}
        >
          <Users className="size-3.5" /> Groups only
        </Link>
        {[["", "All"], ["CONFIRMED", "Confirmed"], ["CHECKED_IN", "In house"], ["CHECKED_OUT", "Checked out"], ["CANCELLED", "Cancelled"], ["NO_SHOW", "No-show"]].map(([value, label]) => (
          <Link
            key={value}
            href={href({ status: value })}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${(sp.status ?? "") === value ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted"}`}
          >
            {label}
            {value && <span className="ml-1.5 opacity-60">{count(value)}</span>}
          </Link>
        ))}
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          {sp.group && <input type="hidden" name="group" value={sp.group} />}
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={sp.q} placeholder="Guest, email, confirmation #, room, group or company" className="pl-9" />
          </div>
          <Select name="dateField" defaultValue={sp.dateField ?? "checkIn"} className="w-40">
            <option value="checkIn">Arrival date</option>
            <option value="checkOut">Departure date</option>
            <option value="createdAt">Booking date</option>
          </Select>
          <Input name="from" type="date" defaultValue={sp.from} className="w-40" aria-label="From" />
          <Input name="to" type="date" defaultValue={sp.to} className="w-40" aria-label="To" />
          <Button type="submit" variant="subtle">Apply</Button>
          {(sp.q || sp.from || sp.to) && (
            <ButtonLink href={buildHref("/admin/reservations", { status: sp.status })} variant="ghost">
              Clear
            </ButtonLink>
          )}
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={<BookOpenCheck />} title="No reservations found" description="Try a different search or clear the filters." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Guest</Th>
                <Th>Confirmation</Th>
                <Th>Stay</Th>
                <Th>Room</Th>
                <Th>Channel</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const folio = summarizeFolio(r);
                return (
                  <tr key={r.id} className="group hover:bg-surface/60">
                    <Td>
                      <Link href={`/admin/reservations/${r.id}`} className="font-medium text-foreground group-hover:text-primary">
                        {r.guest.firstName} {r.guest.lastName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.company ? r.company.name : `${r.adults + r.children} guests · ${r.guest.country ?? "—"}`}</p>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs">{r.code}</span>
                      {r.group && (
                        <Link href={`/admin/groups/${r.group.id}`} className="mt-0.5 block">
                          <Badge tone="gold"><Users className="size-3" /> {r.group.code}</Badge>
                        </Link>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(r.checkIn)} → {formatDate(r.checkOut)}
                      <p className="text-xs text-muted-foreground">{nightsBetween(r.checkIn, r.checkOut)} nights</p>
                    </Td>
                    <Td>
                      {r.room?.number ?? "—"}
                      <p className="text-xs text-muted-foreground">{r.roomType.name}</p>
                    </Td>
                    <Td className="text-muted-foreground">{SOURCE_LABEL[r.source]}</Td>
                    <Td><ReservationStatusBadge status={r.status} /></Td>
                    <Td className="text-right tabular-nums">{formatMoney(folio.total)}</Td>
                    <Td className={`text-right tabular-nums ${folio.balance > 0.004 ? "font-medium text-warning" : "text-muted-foreground"}`}>{formatMoney(folio.balance)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination page={page} total={total} href={(p) => buildHref("/admin/reservations", { ...sp, page: p })} />
      </Card>
    </>
  );
}
