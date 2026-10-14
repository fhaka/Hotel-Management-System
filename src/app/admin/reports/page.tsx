import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { BarList } from "@/components/bar-list";
import { OccupancyChart, RevenueChart } from "@/components/charts";
import { PageHeader, StatCard } from "@/components/page-header";
import { SOURCE_LABEL } from "@/components/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";
import { bookingStats, byCountry, byRoomType, bySource, kpis, occupancySeries, revenueSeries } from "@/lib/analytics";
import { requireStaff } from "@/lib/auth/dal";
import { addDays, addDaysISO, formatDate, isISODate, nightsBetween, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

function presets(today: string) {
  const month = today.slice(0, 7);
  const prevMonthEnd = addDaysISO(`${month}-01`, -1);
  const nextMonth = addDaysISO(`${month}-01`, 32).slice(0, 7);
  return [
    { key: "mtd", label: "Month to date", from: `${month}-01`, to: today },
    { key: "last-month", label: "Last month", from: `${prevMonthEnd.slice(0, 7)}-01`, to: prevMonthEnd },
    { key: "30d", label: "Last 30 days", from: addDaysISO(today, -29), to: today },
    { key: "90d", label: "Last 90 days", from: addDaysISO(today, -89), to: today },
    { key: "next-month", label: "Next month (on the books)", from: `${nextMonth}-01`, to: addDaysISO(`${addDaysISO(`${nextMonth}-01`, 32).slice(0, 7)}-01`, -1) },
  ];
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireStaff("reports");
  const sp = await searchParams;
  const today = todayISO();
  const opts = presets(today);
  const fromISO = isISODate(sp.from) ? sp.from : opts[0]!.from;
  let toISO = isISODate(sp.to) && sp.to >= fromISO ? sp.to : opts[0]!.to;
  if (nightsBetween(parseISODate(fromISO), parseISODate(toISO)) > 366) toISO = addDaysISO(fromISO, 366);
  const from = parseISODate(fromISO);
  const to = addDays(parseISODate(toISO), 1); // inclusive end date
  const days = nightsBetween(from, to);

  const [k, occ, rev, types, sources, countries, stats] = await Promise.all([
    kpis(from, to),
    occupancySeries(from, to),
    revenueSeries(from, to),
    byRoomType(from, to),
    bySource(from, to),
    byCountry(from, to),
    bookingStats(from, to),
  ]);
  const totalBookings = sources.reduce((s, x) => s + x.count, 0);
  const qs = `from=${fromISO}&to=${toISO}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${formatDate(fromISO)} – ${formatDate(toISO)} · ${days} days`}
        actions={
          <>
            <ButtonLink href={`/api/exports/daily?${qs}`} variant="outline" prefetch={false}><Download /> Daily statistics CSV</ButtonLink>
            <ButtonLink href={`/api/exports/reservations?dateField=checkIn&from=${fromISO}&to=${toISO}`} variant="outline" prefetch={false}><Download /> Arrivals CSV</ButtonLink>
          </>
        }
      />
      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => (
              <Link key={o.key} href={`/admin/reports?from=${o.from}&to=${o.to}`} className={cn("rounded-full border px-3 py-1.5 text-sm", fromISO === o.from && toISO === o.to ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}>
                {o.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-end gap-2">
            <Input type="date" name="from" defaultValue={fromISO} className="w-40" aria-label="From" />
            <span className="pb-2 text-muted-foreground">–</span>
            <Input type="date" name="to" defaultValue={toISO} className="w-40" aria-label="To" />
            <Button type="submit" variant="subtle">Apply</Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Occupancy" value={formatPercent(k.occupancy, 1)} hint={`${k.roomNightsSold.toLocaleString("en")} of ${k.availableRoomNights.toLocaleString("en")} room nights`} accent="info" />
        <StatCard label="ADR" value={formatMoney(k.adr)} hint="Average daily rate (room revenue ÷ nights sold)" accent="gold" />
        <StatCard label="RevPAR" value={formatMoney(k.revpar)} hint="Room revenue ÷ available room nights" accent="success" />
        <StatCard label="Total revenue" value={formatMoney(k.totalRevenue, { compact: true })} hint={`Rooms ${formatMoney(k.roomRevenue, { compact: true })} · Extras ${formatMoney(k.otherRevenue, { compact: true })}`} accent="warning" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Daily occupancy" />
          <CardBody><OccupancyChart data={occ} today={today} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Daily revenue" />
          <CardBody><RevenueChart data={rev} height={240} /></CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Performance by room type" />
          <Table>
            <thead>
              <tr>
                <Th>Room type</Th>
                <Th className="text-right">Nights sold</Th>
                <Th className="text-right">Room revenue</Th>
                <Th className="text-right">ADR</Th>
                <Th className="text-right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.name}>
                  <Td className="font-medium">{t.name}</Td>
                  <Td className="text-right tabular-nums">{t.nights.toLocaleString("en")}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(t.revenue)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(t.nights ? t.revenue / t.nights : 0)}</Td>
                  <Td className="text-right tabular-nums text-muted-foreground">{formatPercent(k.roomRevenue ? t.revenue / k.roomRevenue : 0)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Booking behaviour" description="Arrivals in the period" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-muted-foreground">Arrivals booked</dt><dd className="mt-1 text-xl font-semibold">{stats.total}</dd></div>
              <div><dt className="text-muted-foreground">Avg. length of stay</dt><dd className="mt-1 text-xl font-semibold">{stats.avgLengthOfStay.toFixed(1)} nights</dd></div>
              <div><dt className="text-muted-foreground">Avg. booking window</dt><dd className="mt-1 text-xl font-semibold">{Math.round(stats.avgLeadTime)} days</dd></div>
              <div><dt className="text-muted-foreground">Cancellation rate</dt><dd className="mt-1 text-xl font-semibold">{formatPercent(stats.cancellationRate, 1)}</dd></div>
              <div><dt className="text-muted-foreground">No-show rate</dt><dd className="mt-1 text-xl font-semibold">{formatPercent(stats.noShowRate, 1)}</dd></div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bookings by channel" description={`${totalBookings} bookings created in the period`} />
          <CardBody>
            <BarList items={sources.map((s) => ({ label: SOURCE_LABEL[s.source], value: s.count, hint: formatPercent(totalBookings ? s.count / totalBookings : 0) }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Guest origin" description="Top countries by arrivals" />
          <CardBody>
            <BarList items={countries.map((c) => ({ label: c.country, value: c.count }))} />
          </CardBody>
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Revenue figures are posted folio charges including VAT, excluding city tax. Generated {toISODate(new Date())}.
      </p>
    </>
  );
}
