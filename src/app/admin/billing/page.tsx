import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, Receipt, Wallet } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-header";
import { Pagination, PAGE_SIZE, buildHref, pageParam } from "@/components/pagination";
import { INVOICE_STATUS, PAYMENT_METHOD_LABEL, ReservationStatusBadge } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addDays, formatDate, formatDateTime, parseISODate, toISODate, today } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  await requireStaff("billing");
  const sp = await searchParams;
  const view = sp.view === "invoices" ? "invoices" : sp.view === "balances" ? "balances" : "payments";
  const page = pageParam(sp.page);
  const t = today();
  const monthStart = parseISODate(`${toISODate(t).slice(0, 7)}-01`);

  const [takenToday, takenMonth, refundsMonth, openBalances] = await Promise.all([
    db.payment.aggregate({ where: { kind: "CHARGE", status: "SUCCEEDED", createdAt: { gte: new Date(t.getTime() - 2 * 3_600_000) } }, _sum: { amount: true }, _count: true }),
    db.payment.aggregate({ where: { kind: "CHARGE", status: "SUCCEEDED", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { kind: "REFUND", status: "SUCCEEDED", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.$queryRaw<{ id: string; code: string; status: string; first: string; last: string; checkIn: Date; checkOut: Date; balance: string }[]>`
      SELECT * FROM (
        SELECT r.id, r.code, r.status, g."firstName" AS first, g."lastName" AS last, r."checkIn", r."checkOut",
          coalesce((SELECT sum(amount) FROM "FolioCharge" c WHERE c."reservationId" = r.id AND NOT c.voided), 0)
          - coalesce((SELECT sum(CASE WHEN kind = 'CHARGE' THEN amount ELSE -amount END) FROM "Payment" p WHERE p."reservationId" = r.id AND p.status = 'SUCCEEDED'), 0) AS balance
        FROM "Reservation" r JOIN "Guest" g ON g.id = r."guestId"
        WHERE r.status IN ('CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW') OR (r.status = 'CONFIRMED' AND r."checkIn" <= ${addDays(t, 7)})
      ) b WHERE abs(balance) > 0.004 ORDER BY balance DESC LIMIT 200`,
  ]);
  const outstanding = openBalances.filter((b) => Number(b.balance) > 0).reduce((s, b) => s + Number(b.balance), 0);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Payments, invoices and open balances."
        actions={
          <ButtonLink href="/api/exports/payments" variant="outline" prefetch={false}>
            <Download /> Export payments
          </ButtonLink>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Taken today" value={formatMoney(Number(takenToday._sum.amount ?? 0))} hint={`${takenToday._count} payments`} icon={<Wallet />} accent="success" />
        <StatCard label="Taken this month" value={formatMoney(Number(takenMonth._sum.amount ?? 0), { compact: true })} icon={<Receipt />} accent="info" />
        <StatCard label="Refunded this month" value={formatMoney(Number(refundsMonth._sum.amount ?? 0))} accent="gold" />
        <StatCard label="Outstanding balances" value={formatMoney(outstanding)} hint={`${openBalances.filter((b) => Number(b.balance) > 0).length} folios`} icon={<FileText />} accent="warning" />
      </div>
      <div className="mb-6 flex gap-6 border-b border-border">
        {[["payments", "Payments"], ["invoices", "Invoices"], ["balances", "Open balances"]].map(([k, l]) => (
          <Link key={k} href={`/admin/billing?view=${k}`} className={`-mb-px border-b-2 pb-3 text-sm font-medium ${view === k ? "border-gold text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}>
            {l}
          </Link>
        ))}
      </div>
      <Card>{view === "payments" ? <Payments page={page} /> : view === "invoices" ? <Invoices page={page} /> : <Balances rows={openBalances} />}</Card>
    </>
  );
}

async function Payments({ page }: { page: number }) {
  const [total, rows] = await Promise.all([
    db.payment.count(),
    db.payment.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { reservation: { include: { guest: true } }, processedBy: { select: { name: true } } } }),
  ]);
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Guest</Th>
            <Th>Type</Th>
            <Th>Method</Th>
            <Th>Taken by</Th>
            <Th className="text-right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-surface/60">
              <Td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</Td>
              <Td>
                <Link href={`/admin/reservations/${p.reservationId}`} className="font-medium hover:text-primary">{p.reservation.guest.firstName} {p.reservation.guest.lastName}</Link>
                <p className="font-mono text-xs text-muted-foreground">{p.reservation.code}</p>
              </Td>
              <Td><Badge tone={p.kind === "REFUND" ? "violet" : "success"}>{p.kind === "REFUND" ? "Refund" : "Payment"}</Badge></Td>
              <Td>{PAYMENT_METHOD_LABEL[p.method]}{p.cardLast4 && <span className="text-muted-foreground"> · {p.cardBrand} {p.cardLast4}</span>}</Td>
              <Td className="text-muted-foreground">{p.processedBy?.name ?? "Online"}</Td>
              <Td className="text-right font-medium tabular-nums">{p.kind === "REFUND" ? "−" : ""}{formatMoney(p.amount)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} total={total} href={(p) => buildHref("/admin/billing", { view: "payments", page: p })} />
    </>
  );
}

async function Invoices({ page }: { page: number }) {
  const [total, rows] = await Promise.all([
    db.invoice.count(),
    db.invoice.findMany({ orderBy: { issuedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { reservation: { select: { id: true, code: true } } } }),
  ]);
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Invoice</Th>
            <Th>Issued</Th>
            <Th>Bill to</Th>
            <Th>Status</Th>
            <Th className="text-right">Net</Th>
            <Th className="text-right">VAT</Th>
            <Th className="text-right">Total</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className="hover:bg-surface/60">
              <Td className="font-mono text-xs font-medium">{i.number}</Td>
              <Td className="whitespace-nowrap">{formatDate(i.issuedAt)}</Td>
              <Td><Link href={`/admin/reservations/${i.reservation.id}`} className="hover:text-primary">{i.billTo}</Link></Td>
              <Td><Badge tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</Badge></Td>
              <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(i.netTotal)}</Td>
              <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(i.vatTotal)}</Td>
              <Td className="text-right font-medium tabular-nums">{formatMoney(i.total)}</Td>
              <Td className="text-right">
                <a href={`/api/invoices/${i.reservation.code}?view`} target="_blank" className="text-xs font-medium text-primary hover:underline">PDF</a>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} total={total} href={(p) => buildHref("/admin/billing", { view: "invoices", page: p })} />
    </>
  );
}

function Balances({ rows }: { rows: { id: string; code: string; status: string; first: string; last: string; checkIn: Date; checkOut: Date; balance: string }[] }) {
  if (rows.length === 0) return <EmptyState icon={<Wallet />} title="All folios are settled" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Guest</Th>
          <Th>Stay</Th>
          <Th>Status</Th>
          <Th className="text-right">Balance</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const b = Number(r.balance);
          return (
            <tr key={r.id} className="hover:bg-surface/60">
              <Td>
                <Link href={`/admin/reservations/${r.id}`} className="font-medium hover:text-primary">{r.first} {r.last}</Link>
                <p className="font-mono text-xs text-muted-foreground">{r.code}</p>
              </Td>
              <Td className="whitespace-nowrap">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</Td>
              <Td><ReservationStatusBadge status={r.status as never} /></Td>
              <Td className={`text-right font-medium tabular-nums ${b > 0 ? "text-warning" : "text-violet"}`}>{b < 0 ? `Credit ${formatMoney(-b)}` : formatMoney(b)}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
