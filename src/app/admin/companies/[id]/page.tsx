import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-header";
import { ReservationStatusBadge } from "@/components/status";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, nightsBetween } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney } from "@/lib/format";
import { EditCompanyForm } from "../company-form";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("guests");
  const c = await db.company.findUnique({
    where: { id: (await params).id },
    include: {
      reservations: { include: { guest: true, roomType: true, room: true, charges: true, payments: true, group: { select: { id: true, code: true } } }, orderBy: { checkIn: "desc" }, take: 100 },
    },
  });
  if (!c) notFound();

  const stayed = c.reservations.filter((r) => ["CHECKED_IN", "CHECKED_OUT", "NO_SHOW"].includes(r.status));
  const revenue = stayed.reduce((s, r) => s + summarizeFolio(r).total, 0);
  const nights = stayed.reduce((s, r) => s + nightsBetween(r.checkIn, r.checkOut), 0);
  const open = c.reservations.reduce((s, r) => s + Math.max(0, summarizeFolio(r).balance), 0);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/companies", label: "Companies" }}
        title={<span className="flex items-center gap-3"><Building2 className="size-6 text-gold" /> {c.name}</span>}
        description={c.taxId ? `NIPT / VAT ID ${c.taxId}` : "No tax number on file"}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(revenue)} hint="Completed and in-house stays" />
        <StatCard label="Room nights" value={nights} accent="info" />
        <StatCard label="Bookings" value={c.reservations.length} accent="success" />
        <StatCard label="Open balance" value={formatMoney(open)} accent="warning" />
      </div>
      <div className="grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1fr_440px]">
        <Card>
          <CardHeader title="Stays billed to this company" />
          {c.reservations.length === 0 ? (
            <EmptyState title="No stays yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Guest</Th>
                  <Th>Dates</Th>
                  <Th>Room</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {c.reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={`/admin/reservations/${r.id}`} className="font-medium hover:text-primary">{r.occupantName ?? `${r.guest.firstName} ${r.guest.lastName}`}</Link>
                      <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        {r.code}
                        {r.group && (
                          <Link href={`/admin/groups/${r.group.id}`}>
                            <Badge tone="gold"><Users className="size-3" /> {r.group.code}</Badge>
                          </Link>
                        )}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</Td>
                    <Td>{r.room?.number ?? "—"} <span className="text-xs text-muted-foreground">{r.roomType.name}</span></Td>
                    <Td><ReservationStatusBadge status={r.status} /></Td>
                    <Td className="text-right tabular-nums">{formatMoney(summarizeFolio(r).total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Company details" />
          <CardBody>
            <EditCompanyForm
              id={c.id}
              values={{
                name: c.name,
                taxId: c.taxId ?? "",
                contactName: c.contactName ?? "",
                email: c.email ?? "",
                phone: c.phone ?? "",
                address: c.address ?? "",
                city: c.city ?? "",
                country: c.country ?? "",
                notes: c.notes ?? "",
              }}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
