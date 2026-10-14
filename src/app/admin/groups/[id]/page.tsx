import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Download, LogIn, LogOut, Mail, Phone, Plus, Users } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { PageHeader, StatCard } from "@/components/page-header";
import { ROOM_STATUS, ReservationStatusBadge, SOURCE_LABEL } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, DescriptionList, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, nightsBetween, toISODate, today } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney, pluralize } from "@/lib/format";
import { getGroup, summarizeGroup } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import { checkOutAction } from "../../reservations/actions";
import { PaymentDialog } from "../../reservations/[id]/panels";
import { checkInGroupAction, groupPaymentAction } from "../actions";
import { CancelGroupDialog, EditGroupDialog, GroupEmailMenu } from "./panels";

export const metadata: Metadata = { title: "Group booking" };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff("reservations");
  const g = await getGroup({ id: (await params).id });
  if (!g) notFound();

  const [companies, history] = await Promise.all([
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, taxId: true } }),
    db.auditLog.findMany({
      where: { OR: [{ entity: "ReservationGroup", entityId: g.id }, { entity: "Reservation", entityId: { in: g.reservations.map((r) => r.id) } }] },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const t = today();
  const folio = summarizeGroup(g);
  const first = g.reservations[0]!;
  const active = g.reservations.filter((r) => r.status !== "CANCELLED");
  const arrivingToday = g.reservations.filter((r) => (r.status === "CONFIRMED" || r.status === "PENDING") && r.checkIn <= t && r.checkOut > t);
  const upcoming = g.reservations.filter((r) => r.status === "CONFIRMED" || r.status === "PENDING");
  const guests = active.reduce((s, r) => s + r.adults + r.children, 0);
  const remaining = g.reservations.filter((r) => ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(r.status)).length;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/reservations?group=1", label: "Reservations" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {g.name}
            <Badge tone="gold">
              <Users className="size-3" /> Group · {pluralize(active.length, "room")}
            </Badge>
          </span>
        }
        description={
          <>
            Group <span className="font-mono font-medium text-foreground">{g.code}</span> · {formatDate(first.checkIn)} – {formatDate(first.checkOut)} ·{" "}
            {pluralize(nightsBetween(first.checkIn, first.checkOut), "night")} · {pluralize(guests, "guest")}
          </>
        }
        actions={
          <>
            {arrivingToday.length > 0 && can(user.role, "frontDesk") && (
              <ActionButton action={checkInGroupAction.bind(null, g.id)}>
                <LogIn /> Check in {arrivingToday.length > 1 ? `all ${arrivingToday.length}` : "room"}
              </ActionButton>
            )}
            <ButtonLink href={`/admin/reservations/new?groupId=${g.id}`} variant="outline">
              <Plus /> Add room
            </ButtonLink>
            <EditGroupDialog
              id={g.id}
              values={{ name: g.name, companyId: g.companyId ?? "", singleBill: g.singleBill, notes: g.notes ?? "" }}
              companies={companies}
              invoiced={!!g.invoice}
            />
            <GroupEmailMenu id={g.id} hasEmail={!!g.booker.email} upcoming={upcoming.length > 0} departed={!!g.invoice} />
            {upcoming.length > 0 && <CancelGroupDialog id={g.id} rooms={upcoming.length} />}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Group total" value={formatMoney(folio.total)} hint={`incl. ${formatMoney(folio.vat)} VAT`} />
        <StatCard label="Paid" value={formatMoney(folio.paid - folio.refunded)} accent="success" />
        <StatCard label={folio.balance < -0.004 ? "Credit" : "Balance due"} value={formatMoney(Math.abs(folio.balance))} accent={folio.balance > 0.004 ? "warning" : "success"} />
        <StatCard
          label="Billing"
          value={g.singleBill ? "One bill" : "Separate bills"}
          hint={g.invoice ? `Invoice ${g.invoice.number}` : g.singleBill ? `Settled when the last room departs (${remaining} still to go)` : "Each room is invoiced at its check-out"}
          accent="info"
        />
      </div>

      <div className="grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Rooms" description="Each room keeps its own folio, room assignment and check-in/out." />
            <Table>
              <thead>
                <tr>
                  <Th>Room</Th>
                  <Th>Guest</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Charges</Th>
                  <Th className="text-right">Balance</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {g.reservations.map((r) => {
                  const f = summarizeFolio(r);
                  const roomStatus = r.room ? ROOM_STATUS[r.room.status] : null;
                  const lastToLeave = g.singleBill && remaining === 1;
                  return (
                    <tr key={r.id} className={cn("hover:bg-surface/60", r.status === "CANCELLED" && "opacity-60")}>
                      <Td>
                        <Link href={`/admin/reservations/${r.id}`} className="font-medium hover:text-primary">
                          {r.room ? `Room ${r.room.number}` : "Unassigned"}
                        </Link>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {roomStatus && <span className={`size-1.5 rounded-full ${roomStatus.dot}`} />}
                          {r.roomType.name} · <span className="font-mono">{r.code}</span>
                        </p>
                      </Td>
                      <Td>
                        {r.occupantName ?? <span className="text-muted-foreground">—</span>}
                        <p className="text-xs text-muted-foreground">
                          {pluralize(r.adults, "adult")}
                          {r.children ? `, ${pluralize(r.children, "child", "children")}` : ""}
                        </p>
                      </Td>
                      <Td><ReservationStatusBadge status={r.status} /></Td>
                      <Td className="text-right tabular-nums">{formatMoney(f.total)}</Td>
                      <Td className={cn("text-right tabular-nums", f.balance > 0.004 ? "text-warning" : "text-muted-foreground")}>{formatMoney(f.balance)}</Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          {r.status === "CHECKED_IN" && can(user.role, "frontDesk") && (
                            <ActionButton
                              size="sm"
                              variant="outline"
                              action={checkOutAction.bind(null, r.id)}
                              confirm={lastToLeave ? "This is the last room of the group: the group bill must be settled and the group invoice will be issued." : `Check out room ${r.room?.number}? Its charges stay on the group bill.`}
                            >
                              <LogOut /> Check out
                            </ActionButton>
                          )}
                          <ButtonLink href={`/admin/reservations/${r.id}`} size="sm" variant="ghost">
                            Open
                          </ButtonLink>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                  <span>{h.summary}</span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {h.user?.name ?? "Guest (online)"}
                    <br />
                    {formatDateTime(h.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={cn(folio.balance > 0.004 && "border-warning/40")}>
            <CardHeader title="Group bill" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Rooms", formatMoney(g.reservations.reduce((s, r) => s + r.charges.filter((c) => !c.voided && c.type === "ROOM").reduce((n, c) => n + Number(c.amount), 0), 0))],
                  ["Extras & services", formatMoney(g.reservations.reduce((s, r) => s + r.charges.filter((c) => !c.voided && c.type !== "ROOM" && c.type !== "CITY_TAX").reduce((n, c) => n + Number(c.amount), 0), 0))],
                  ["City tax", formatMoney(g.reservations.reduce((s, r) => s + r.charges.filter((c) => !c.voided && c.type === "CITY_TAX").reduce((n, c) => n + Number(c.amount), 0), 0))],
                  ["Total", formatMoney(folio.total)],
                  ["Paid", formatMoney(folio.paid - folio.refunded)],
                ]}
              />
              <div className="mt-4 grid gap-2">
                {can(user.role, "billing") && (
                  <PaymentDialog
                    id={first.id}
                    balance={Math.max(folio.balance, 0)}
                    action={groupPaymentAction.bind(null, g.id)}
                    label="Take group payment"
                    description={`Group balance: ${formatMoney(Math.max(folio.balance, 0))}. The payment is split across rooms with an open balance.`}
                  />
                )}
                <ButtonLink href={`/api/invoices/${g.code}?view`} target="_blank" variant="outline" prefetch={false}>
                  <Download /> {g.invoice ? `Group invoice ${g.invoice.number}` : "Pro-forma group invoice"}
                </ButtonLink>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Booker" action={<ButtonLink href={`/admin/guests/${g.booker.id}`} variant="ghost" size="sm">Profile</ButtonLink>} />
            <CardBody className="space-y-2 text-sm">
              <p className="font-medium">{g.booker.firstName} {g.booker.lastName}</p>
              {g.booker.email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="size-4" /> {g.booker.email}</p>}
              {g.booker.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-4" /> {g.booker.phone}</p>}
              <p className="text-muted-foreground">Booked {formatDateTime(g.createdAt)} · {SOURCE_LABEL[first.source]}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Invoice to" />
            <CardBody className="text-sm">
              {g.company ? (
                <Link href={`/admin/companies/${g.company.id}`} className="group flex items-start gap-3">
                  <Building2 className="mt-0.5 size-4 text-gold" />
                  <span>
                    <span className="font-medium group-hover:text-primary">{g.company.name}</span>
                    {g.company.taxId && <span className="block text-muted-foreground">NIPT {g.company.taxId}</span>}
                    {g.company.address && <span className="block text-muted-foreground">{[g.company.address, g.company.city].filter(Boolean).join(", ")}</span>}
                  </span>
                </Link>
              ) : (
                <p className="text-muted-foreground">The booker (private guest). Assign a company with “Edit group”.</p>
              )}
              {g.notes && <p className="mt-3 rounded-lg bg-gold-soft/60 px-3 py-2 text-[#7a5d2c]">{g.notes}</p>}
              <p className="mt-3 text-xs text-muted-foreground">Arrival {toISODate(first.checkIn)} · created by {first.createdBy?.name ?? "the guest online"}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
