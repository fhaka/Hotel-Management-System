import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Search, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination, PAGE_SIZE, buildHref, pageParam } from "@/components/pagination";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Avatar, Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string; vip?: string; page?: string }> }) {
  await requireStaff("guests");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const q = sp.q?.trim();
  const where: Prisma.GuestWhereInput = {
    ...(sp.vip ? { vip: true } : {}),
    ...(q
      ? {
          AND: q.split(/\s+/).map((p) => ({
            OR: [
              { firstName: { contains: p, mode: "insensitive" as const } },
              { lastName: { contains: p, mode: "insensitive" as const } },
              { email: { contains: p, mode: "insensitive" as const } },
              { phone: { contains: p } },
              { country: { contains: p, mode: "insensitive" as const } },
            ],
          })),
        }
      : {}),
  };
  const [total, guests] = await Promise.all([
    db.guest.count({ where }),
    db.guest.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { _count: { select: { reservations: true } } } }),
  ]);

  const ids = guests.map((g) => g.id);
  const stats = ids.length
    ? await db.$queryRaw<{ guestId: string; last: Date | null; revenue: string | null }[]>`
        SELECT r."guestId",
               max(r."checkOut") FILTER (WHERE r.status = 'CHECKED_OUT') AS last,
               (SELECT sum(c.amount) FROM "FolioCharge" c JOIN "Reservation" r2 ON r2.id = c."reservationId" WHERE r2."guestId" = r."guestId" AND NOT c.voided AND r2.status = 'CHECKED_OUT') AS revenue
          FROM "Reservation" r WHERE r."guestId" = ANY(${ids}) GROUP BY r."guestId"`
    : [];
  const statFor = (id: string) => stats.find((s) => s.guestId === id);

  return (
    <>
      <PageHeader
        title="Guests"
        description={`${total.toLocaleString("en")} guest profiles`}
        actions={
          <ButtonLink href="/admin/guests/new">
            <UserPlus /> New guest
          </ButtonLink>
        }
      />
      <Card>
        <form className="flex flex-wrap gap-3 border-b border-border p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search name, email, phone or country" className="pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vip" value="1" defaultChecked={!!sp.vip} className="size-4 accent-[#0f1a2e]" /> VIP only
          </label>
          <Button type="submit" variant="subtle">Search</Button>
        </form>
        {guests.length === 0 ? (
          <EmptyState icon={<Users />} title="No guests found" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Guest</Th>
                <Th>Contact</Th>
                <Th>Country</Th>
                <Th className="text-right">Stays</Th>
                <Th>Last stay</Th>
                <Th className="text-right">Lifetime value</Th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => {
                const s = statFor(g.id);
                return (
                  <tr key={g.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={`/admin/guests/${g.id}`} className="flex items-center gap-3">
                        <Avatar name={`${g.firstName} ${g.lastName}`} />
                        <span className="font-medium hover:text-primary">
                          {g.firstName} {g.lastName}
                        </span>
                        {g.vip && <Badge tone="gold"><Crown className="size-3" /> VIP</Badge>}
                        {g.userId && <Badge tone="info">Account</Badge>}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">
                      {g.email ?? "—"}
                      <p className="text-xs">{g.phone}</p>
                    </Td>
                    <Td className="text-muted-foreground">{g.country ?? "—"}</Td>
                    <Td className="text-right tabular-nums">{g._count.reservations}</Td>
                    <Td className="text-muted-foreground">{s?.last ? formatDate(s.last) : "—"}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(Number(s?.revenue ?? 0))}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination page={page} total={total} href={(p) => buildHref("/admin/guests", { ...sp, page: p })} />
      </Card>
    </>
  );
}
