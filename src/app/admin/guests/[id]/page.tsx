import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-header";
import { ReservationStatusBadge } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, nightsBetween, toISODate } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney } from "@/lib/format";
import { GuestEditForm } from "./edit-form";

export const metadata: Metadata = { title: "Guest" };

export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("guests");
  const { id } = await params;
  const guest = await db.guest.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, createdAt: true } },
      reservations: { include: { roomType: true, room: true, charges: true, payments: true }, orderBy: { checkIn: "desc" } },
    },
  });
  if (!guest) notFound();

  const completed = guest.reservations.filter((r) => r.status === "CHECKED_OUT");
  const lifetime = completed.reduce((s, r) => s + summarizeFolio(r).total, 0);
  const nights = completed.reduce((s, r) => s + nightsBetween(r.checkIn, r.checkOut), 0);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/guests", label: "Guests" }}
        title={
          <span className="flex items-center gap-3">
            {guest.firstName} {guest.lastName}
            {guest.vip && <Badge tone="gold"><Crown className="size-3" /> VIP</Badge>}
          </span>
        }
        description={guest.user ? `Website account since ${formatDate(guest.user.createdAt)}` : "No website account"}
        actions={
          <ButtonLink href={`/admin/reservations/new?guestId=${guest.id}`}>
            <Plus /> New reservation
          </ButtonLink>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Completed stays" value={completed.length} hint={`${guest.reservations.length} reservations in total`} />
        <StatCard label="Nights stayed" value={nights} />
        <StatCard label="Lifetime value" value={formatMoney(lifetime)} hint={completed.length ? `${formatMoney(lifetime / completed.length)} per stay` : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title="Stay history" />
          {guest.reservations.length === 0 ? (
            <EmptyState title="No stays yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Confirmation</Th>
                  <Th>Dates</Th>
                  <Th>Room</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {guest.reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={`/admin/reservations/${r.id}`} className="font-mono text-xs font-medium hover:text-primary">{r.code}</Link>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</Td>
                    <Td>
                      {r.room?.number ?? "—"} <span className="text-xs text-muted-foreground">{r.roomType.name}</span>
                    </Td>
                    <Td><ReservationStatusBadge status={r.status} /></Td>
                    <Td className="text-right tabular-nums">{formatMoney(summarizeFolio(r).total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <GuestEditForm
              id={guest.id}
              values={{
                firstName: guest.firstName,
                lastName: guest.lastName,
                email: guest.email ?? "",
                phone: guest.phone ?? "",
                country: guest.country ?? "",
                city: guest.city ?? "",
                address: guest.address ?? "",
                idType: guest.idType ?? "",
                idNumber: guest.idNumber ?? "",
                dateOfBirth: guest.dateOfBirth ? toISODate(guest.dateOfBirth) : "",
                notes: guest.notes ?? "",
                vip: guest.vip,
              }}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
