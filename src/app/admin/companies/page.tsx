import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Card, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { NewCompanyDialog } from "./company-form";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("guests");
  const q = (await searchParams).q?.trim();
  const companies = await db.company.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { taxId: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true, groups: true } } },
  });
  const ids = companies.map((c) => c.id);
  const revenue = ids.length
    ? await db.$queryRaw<{ companyId: string; total: string | null }[]>`
        SELECT r."companyId", sum(c.amount) AS total
          FROM "Reservation" r JOIN "FolioCharge" c ON c."reservationId" = r.id AND NOT c.voided
         WHERE r."companyId" = ANY(${ids}) AND r.status IN ('CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW')
         GROUP BY r."companyId"`
    : [];

  return (
    <>
      <PageHeader title="Companies" description="Corporate accounts for business stays and company invoices." actions={<NewCompanyDialog />} />
      <Card>
        <form className="flex gap-3 border-b border-border p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search by name, tax number or city" className="pl-9" />
          </div>
          <Button type="submit" variant="subtle">Search</Button>
        </form>
        {companies.length === 0 ? (
          <EmptyState icon={<Building2 />} title="No companies yet" description="Companies are created automatically when guests request a company invoice, or add one here." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Tax number</Th>
                <Th>Contact</Th>
                <Th className="text-right">Stays</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/admin/companies/${c.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-gold-soft text-[#8a6a32]"><Building2 className="size-4" /></span>
                      <span>
                        {c.name}
                        <span className="block text-xs font-normal text-muted-foreground">{[c.city, c.country].filter(Boolean).join(", ")}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs">{c.taxId ?? "—"}</Td>
                  <Td className="text-muted-foreground">
                    {c.contactName ?? "—"}
                    <p className="text-xs">{c.email}</p>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {c._count.reservations}
                    {c._count.groups > 0 && <p className="text-xs text-muted-foreground">{c._count.groups} groups</p>}
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(Number(revenue.find((r) => r.companyId === c.id)?.total ?? 0))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
