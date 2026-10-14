import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SERVICE_CATEGORY } from "@/components/status";
import { Badge, Card, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/format";
import { ServiceDialog } from "./service-dialog";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const user = await requireStaff("services");
  const t = today();
  const [services, usage] = await Promise.all([
    db.service.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.folioCharge.groupBy({ by: ["serviceId"], where: { serviceId: { not: null }, voided: false, date: { gte: addDays(t, -30), lte: t } }, _sum: { amount: true }, _count: true }),
  ]);
  const manage = can(user.role, "manageServices");
  return (
    <>
      <PageHeader title="Services & extras" description="Items that can be posted to a guest folio or offered as add-ons during online booking." actions={manage ? <ServiceDialog /> : null} />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Category</Th>
              <Th className="text-right">Price</Th>
              <Th>Online add-on</Th>
              <Th className="text-right">Revenue (30 days)</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const u = usage.find((x) => x.serviceId === s.id);
              return (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <Td>
                    <p className="font-medium">{s.name} {!s.active && <Badge className="ml-1">Inactive</Badge>}</p>
                    <p className="max-w-md truncate text-xs text-muted-foreground">{s.description}</p>
                  </Td>
                  <Td className="text-muted-foreground">{SERVICE_CATEGORY[s.category]}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(s.price)} <span className="text-xs text-muted-foreground">/ {s.unit}</span></Td>
                  <Td>{s.bookable ? <Badge tone="success">Yes{s.perNight ? " · per night" : ""}{s.perGuest ? " · per guest" : ""}</Badge> : <span className="text-muted-foreground">—</span>}</Td>
                  <Td className="text-right tabular-nums">
                    {formatMoney(Number(u?._sum.amount ?? 0))}
                    <p className="text-xs text-muted-foreground">{u?._count ?? 0} posts</p>
                  </Td>
                  <Td className="text-right">
                    {manage && (
                      <ServiceDialog
                        service={{ id: s.id, name: s.name, category: s.category, description: s.description ?? "", price: toNumber(s.price), unit: s.unit, bookable: s.bookable, perNight: s.perNight, perGuest: s.perGuest, active: s.active }}
                      />
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
