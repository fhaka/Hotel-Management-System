import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, Crown, LogIn, LogOut, Mail, Plus, UserX } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { PageHeader } from "@/components/page-header";
import { ROOM_STATUS, ReservationStatusBadge } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addDays, formatDate, formatLongDate, nightsBetween, today } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { checkInAction, checkOutAction, noShowAction, sendEmailAction, sendTomorrowRemindersAction } from "../reservations/actions";

export const metadata: Metadata = { title: "Front desk" };

const include = {
  guest: true,
  room: true,
  roomType: true,
  charges: { select: { amount: true, vatRate: true, voided: true, type: true } },
  payments: { select: { amount: true, kind: true, status: true } },
} as const;

export default async function FrontDeskPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("frontDesk");
  const { tab = "arrivals" } = await searchParams;
  const t = today();

  const [arrivals, departures, inHouse, overdue, tomorrow] = await Promise.all([
    db.reservation.findMany({ where: { checkIn: t, status: { in: ["CONFIRMED", "PENDING", "CHECKED_IN"] } }, include, orderBy: [{ status: "asc" }, { estimatedArrival: "asc" }] }),
    db.reservation.findMany({ where: { checkOut: t, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } }, include, orderBy: [{ status: "asc" }] }),
    db.reservation.findMany({ where: { status: "CHECKED_IN" }, include, orderBy: { room: { number: "asc" } } }),
    db.reservation.findMany({ where: { checkIn: { lt: t }, status: "CONFIRMED" }, include, orderBy: { checkIn: "asc" } }),
    db.reservation.count({ where: { checkIn: addDays(t, 1), status: "CONFIRMED" } }),
  ]);

  const tabs = [
    { key: "arrivals", label: "Arrivals", count: arrivals.filter((a) => a.status !== "CHECKED_IN").length, rows: arrivals },
    { key: "departures", label: "Departures", count: departures.filter((d) => d.status === "CHECKED_IN").length, rows: departures },
    { key: "in-house", label: "In house", count: inHouse.length, rows: inHouse },
    { key: "overdue", label: "Overdue arrivals", count: overdue.length, rows: overdue },
  ];
  const current = tabs.find((x) => x.key === tab) ?? tabs[0]!;

  return (
    <>
      <PageHeader
        title="Front desk"
        description={`${formatLongDate(t)} · ${tomorrow} arrivals expected tomorrow`}
        actions={
          <>
            <ActionButton variant="outline" action={sendTomorrowRemindersAction} disabled={tomorrow === 0}>
              <Mail /> Send tomorrow&apos;s reminders
            </ActionButton>
            <ButtonLink href={`/admin/reservations/new`}>
              <Plus /> Walk-in booking
            </ButtonLink>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <Link
            key={x.key}
            href={`/admin/front-desk?tab=${x.key}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              x.key === current.key ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted",
            )}
          >
            {x.label}
            <span className={cn("rounded-full px-1.5 text-xs", x.key === current.key ? "bg-white/20" : x.key === "overdue" && x.count ? "bg-danger-soft text-danger" : "bg-muted")}>{x.count}</span>
          </Link>
        ))}
      </div>

      <Card>
        {current.rows.length === 0 ? (
          <EmptyState icon={<BedDouble />} title={`No ${current.label.toLowerCase()}`} description="Nothing needs your attention here right now." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Guest</Th>
                <Th>Room</Th>
                <Th>Stay</Th>
                <Th>Status</Th>
                <Th className="text-right">Balance</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {current.rows.map((r) => {
                const folio = summarizeFolio(r);
                const roomStatus = r.room ? ROOM_STATUS[r.room.status] : null;
                return (
                  <tr key={r.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={`/admin/reservations/${r.id}`} className="font-medium hover:text-primary">
                        {r.guest.firstName} {r.guest.lastName}
                      </Link>
                      {r.guest.vip && <Badge tone="gold" className="ml-2"><Crown className="size-3" /> VIP</Badge>}
                      <p className="text-xs text-muted-foreground">
                        {r.code} · {r.adults + r.children} guests{r.estimatedArrival && r.status !== "CHECKED_IN" ? ` · ETA ${r.estimatedArrival}` : ""}
                      </p>
                      {r.specialRequests && <p className="mt-1 max-w-xs truncate text-xs text-[#8a6a32]">“{r.specialRequests}”</p>}
                    </Td>
                    <Td>
                      <p className="font-medium">{r.room?.number ?? "—"}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {roomStatus && <span className={`size-1.5 rounded-full ${roomStatus.dot}`} />}
                        {r.roomType.name}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {formatDate(r.checkIn)} → {formatDate(r.checkOut)}
                      <p className="text-xs text-muted-foreground">{nightsBetween(r.checkIn, r.checkOut)} nights</p>
                    </Td>
                    <Td><ReservationStatusBadge status={r.status} /></Td>
                    <Td className={cn("text-right tabular-nums", folio.balance > 0.004 ? "font-medium text-warning" : "text-muted-foreground")}>{formatMoney(folio.balance)}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        {(r.status === "CONFIRMED" || r.status === "PENDING") && current.key !== "overdue" && (
                          <ActionButton
                            size="sm"
                            action={checkInAction.bind(null, r.id, r.room?.status === "DIRTY")}
                            confirm={r.room?.status === "DIRTY" ? `Room ${r.room.number} is not clean yet. Check in anyway?` : undefined}
                          >
                            <LogIn /> Check in
                          </ActionButton>
                        )}
                        {r.status === "CHECKED_IN" && current.key !== "arrivals" && (
                          folio.balance > 0.004 ? (
                            <ButtonLink href={`/admin/reservations/${r.id}`} size="sm" variant="outline">Settle bill</ButtonLink>
                          ) : (
                            <ActionButton size="sm" variant="gold" action={checkOutAction.bind(null, r.id)} confirm={`Check out ${r.guest.firstName} ${r.guest.lastName}?`}>
                              <LogOut /> Check out
                            </ActionButton>
                          )
                        )}
                        {current.key === "overdue" && (
                          <>
                            <ActionButton size="sm" variant="outline" action={sendEmailAction.bind(null, r.id, "pre-arrival")}>
                              <Mail /> Remind
                            </ActionButton>
                            <ActionButton size="sm" variant="danger-outline" action={noShowAction.bind(null, r.id)} confirm="Mark as no-show? The first night will be charged.">
                              <UserX /> No-show
                            </ActionButton>
                          </>
                        )}
                        {r.status === "CHECKED_OUT" && <span className="text-xs text-muted-foreground">Departed</span>}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
