import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BedDouble, CalendarCheck, Euro, LogIn, LogOut, Percent, Plus, Users } from "lucide-react";
import { BarList } from "@/components/bar-list";
import { OccupancyChart, RevenueChart } from "@/components/charts";
import { PageHeader, StatCard } from "@/components/page-header";
import { ROOM_STATUS, ReservationStatusBadge } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { kpis, occupancySeries, revenueSeries } from "@/lib/analytics";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { addDays, formatDateTime, formatLongDate, parseISODate, toISODate, today } from "@/lib/dates";
import { formatMoney, formatPercent, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireStaff();
  if (!can(user.role, "dashboard")) redirect("/admin/housekeeping");

  const t = today();
  const monthStart = parseISODate(`${toISODate(t).slice(0, 7)}-01`);
  const prevMonthStart = parseISODate(`${toISODate(addDays(monthStart, -1)).slice(0, 7)}-01`);
  const prevMonthSameDay = addDays(prevMonthStart, Math.round((t.getTime() - monthStart.getTime()) / 86_400_000) + 1);

  const [mtd, prev, occ, revenue, arrivals, departures, inHouse, roomStatus, recent, outstanding] = await Promise.all([
    kpis(monthStart, addDays(t, 1)),
    kpis(prevMonthStart, prevMonthSameDay),
    occupancySeries(addDays(t, -13), addDays(t, 15)),
    revenueSeries(addDays(t, -29), addDays(t, 1)),
    db.reservation.findMany({ where: { checkIn: t, status: { in: ["CONFIRMED", "CHECKED_IN", "PENDING"] } }, include: { guest: true, room: true, roomType: true }, orderBy: { estimatedArrival: "asc" } }),
    db.reservation.findMany({ where: { checkOut: t, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } }, include: { guest: true, room: true }, orderBy: { room: { number: "asc" } } }),
    db.reservation.findMany({ where: { status: "CHECKED_IN" }, select: { adults: true, children: true } }),
    db.room.groupBy({ by: ["status"], where: { active: true }, _count: true }),
    db.reservation.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { guest: true, roomType: true } }),
    db.$queryRaw<{ count: bigint; total: string | null }[]>`
      SELECT count(*) AS count, sum(balance) AS total FROM (
        SELECT r.id,
          coalesce((SELECT sum(amount) FROM "FolioCharge" c WHERE c."reservationId" = r.id AND NOT c.voided), 0)
          - coalesce((SELECT sum(CASE WHEN kind = 'CHARGE' THEN amount ELSE -amount END) FROM "Payment" p WHERE p."reservationId" = r.id AND p.status = 'SUCCEEDED'), 0) AS balance
        FROM "Reservation" r WHERE r.status = 'CHECKED_IN'
      ) b WHERE balance > 0.004`,
  ]);

  const tonight = occ.find((o) => o.date === toISODate(t));
  const guestsInHouse = inHouse.reduce((s, r) => s + r.adults + r.children, 0);
  const arrived = arrivals.filter((a) => a.status === "CHECKED_IN").length;
  const departed = departures.filter((d) => d.status === "CHECKED_OUT").length;
  const delta = (a: number, b: number) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(((a - b) / b) * 100).toFixed(0)}% vs. last month` : "");
  const statusCount = (s: keyof typeof ROOM_STATUS) => roomStatus.find((r) => r.status === s)?._count ?? 0;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Tirane" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        description={formatLongDate(t)}
        actions={
          <>
            <ButtonLink href="/admin/front-desk" variant="outline">
              <CalendarCheck /> Front desk
            </ButtonLink>
            <ButtonLink href="/admin/reservations/new">
              <Plus /> New reservation
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Occupancy tonight" value={formatPercent(tonight?.occupancy ?? 0)} hint={`${tonight?.sold ?? 0} of ${tonight?.rooms ?? 0} rooms sold`} icon={<Percent />} accent="info" />
        <StatCard label="Guests in house" value={guestsInHouse} hint={pluralize(inHouse.length, "occupied room")} icon={<Users />} accent="success" />
        <StatCard label="ADR (month to date)" value={formatMoney(mtd.adr)} hint={`RevPAR ${formatMoney(mtd.revpar)} · ${delta(mtd.adr, prev.adr)}`} icon={<BedDouble />} accent="gold" />
        <StatCard label="Revenue (month to date)" value={formatMoney(mtd.totalRevenue, { compact: true })} hint={delta(mtd.totalRevenue, prev.totalRevenue)} icon={<Euro />} accent="warning" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Occupancy" description="Last 14 days and the next 14 days (lighter bars are on-the-books forecast)." />
          <CardBody>
            <OccupancyChart data={occ} today={toISODate(t)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Room status" description="Live housekeeping status" action={<ButtonLink href="/admin/housekeeping" variant="ghost" size="sm">Housekeeping <ArrowRight /></ButtonLink>} />
          <CardBody className="grid grid-cols-2 gap-3">
            {(Object.keys(ROOM_STATUS) as (keyof typeof ROOM_STATUS)[]).map((s) => (
              <div key={s} className="rounded-lg border border-border p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={`size-2 rounded-full ${ROOM_STATUS[s].dot}`} /> {ROOM_STATUS[s].label}
                </p>
                <p className="mt-1 text-2xl font-semibold">{statusCount(s)}</p>
              </div>
            ))}
            <div className="col-span-2 rounded-lg bg-warning-soft/60 px-4 py-3 text-sm">
              <span className="font-medium text-warning">{Number(outstanding[0]?.count ?? 0)} in-house folios</span>
              <span className="text-muted-foreground"> carry an open balance of {formatMoney(Number(outstanding[0]?.total ?? 0))}.</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MovementList
          title="Arrivals today"
          icon={<LogIn />}
          progress={`${arrived} of ${arrivals.length} checked in`}
          items={arrivals.map((a) => ({ id: a.id, name: `${a.guest.firstName} ${a.guest.lastName}`, vip: a.guest.vip, detail: `${a.roomType.name}${a.room ? ` · Room ${a.room.number}` : ""}${a.estimatedArrival ? ` · ETA ${a.estimatedArrival}` : ""}`, status: a.status }))}
        />
        <MovementList
          title="Departures today"
          icon={<LogOut />}
          progress={`${departed} of ${departures.length} checked out`}
          items={departures.map((d) => ({ id: d.id, name: `${d.guest.firstName} ${d.guest.lastName}`, vip: d.guest.vip, detail: d.room ? `Room ${d.room.number}` : "", status: d.status }))}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Revenue, last 30 days" description="Posted charges incl. VAT, excluding city tax." />
          <CardBody>
            <RevenueChart data={revenue} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Latest bookings" action={<ButtonLink href="/admin/reservations?dateField=createdAt" variant="ghost" size="sm">All <ArrowRight /></ButtonLink>} />
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/reservations/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface/60">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.guest.firstName} {r.guest.lastName}</p>
                    <p className="text-xs text-muted-foreground">{r.roomType.name} · {formatDateTime(r.createdAt)}</p>
                  </div>
                  <ReservationStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
          <CardBody className="border-t border-border">
            <p className="mb-3 text-sm font-medium">Month to date</p>
            <BarList
              items={[
                { label: "Room revenue", value: mtd.roomRevenue },
                { label: "Dining, spa & extras", value: mtd.otherRevenue },
              ]}
              format={(n) => formatMoney(n, { compact: true })}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function MovementList({ title, icon, progress, items }: { title: string; icon: React.ReactNode; progress: string; items: { id: string; name: string; vip: boolean; detail: string; status: string }[] }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-gold">{icon} {title}</span>} description={progress} action={<ButtonLink href="/admin/front-desk" variant="ghost" size="sm">Front desk <ArrowRight /></ButtonLink>} />
      {items.length === 0 ? (
        <EmptyState title="Nothing scheduled" className="py-8" />
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/admin/reservations/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {i.name} {i.vip && <span className="ml-1 text-xs text-gold">VIP</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{i.detail}</p>
                </div>
                <ReservationStatusBadge status={i.status as never} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
