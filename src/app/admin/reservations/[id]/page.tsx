import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Building2, Crown, Download, LogIn, LogOut, Mail, Phone, Star, UserX, Users } from "lucide-react";
import { Stars } from "@/components/stars";
import { sendReviewRequestAction } from "../../reviews/actions";
import { ActionButton } from "@/components/action-ui";
import { PageHeader } from "@/components/page-header";
import { PAYMENT_METHOD_LABEL, ReservationStatusBadge, RoomStatusBadge, SOURCE_LABEL } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, DescriptionList, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { findFreeRooms } from "@/lib/availability";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatLongDate, nightsBetween, toISODate, today } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney, pluralize, toNumber } from "@/lib/format";
import { getReservation, groupFolio } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import { checkInAction, checkOutAction, noShowAction } from "../actions";
import { BillToDialog } from "../../companies/company-form";
import { AddChargeDialog, AssignRoomDialog, CancelDialog, DetailsForm, EmailMenu, ModifyStayDialog, PaymentDialog, RefundDialog, VoidChargeButton } from "./panels";

export const metadata: Metadata = { title: "Reservation" };

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff("reservations");
  const r = await getReservation(id);
  if (!r) notFound();

  const t = today();
  const active = ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(r.status);
  const [freeRooms, roomTypes, services, history, emails, companies, siblings, review] = await Promise.all([
    active ? findFreeRooms(db, { roomTypeId: r.roomTypeId, checkIn: r.checkIn, checkOut: r.checkOut, excludeReservationId: r.id }) : [],
    db.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, maxAdults: true, maxChildren: true } }),
    db.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.auditLog.findMany({ where: { entity: "Reservation", entityId: r.id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.emailLog.findMany({ where: { reservationId: r.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, taxId: true } }),
    r.groupId ? db.reservation.findMany({ where: { groupId: r.groupId }, select: { id: true, status: true, room: { select: { number: true } } }, orderBy: { createdAt: "asc" } }) : [],
    db.review.findUnique({ where: { reservationId: r.id } }),
  ]);
  const groupBill = r.group?.singleBill ? await groupFolio(db, r.group.id) : null;
  const othersStaying = siblings.filter((x) => x.id !== r.id && ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(x.status)).length;

  const folio = summarizeFolio(r);
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const canCheckIn = (r.status === "CONFIRMED" || r.status === "PENDING") && t >= r.checkIn && t < r.checkOut;
  const canCheckOut = r.status === "CHECKED_IN";
  const canNoShow = r.status === "CONFIRMED" && t >= r.checkIn;
  const editableFolio = !["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(r.status);
  const roomDirty = r.room?.status === "DIRTY";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/reservations", label: "Reservations" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {r.guest.firstName} {r.guest.lastName}
            <ReservationStatusBadge status={r.status} />
            {r.guest.vip && (
              <Badge tone="gold">
                <Crown className="size-3" /> VIP
              </Badge>
            )}
          </span>
        }
        description={
          <>
            Reservation <span className="font-mono font-medium text-foreground">{r.code}</span> · {formatDate(r.checkIn)} – {formatDate(r.checkOut)} ·{" "}
            {pluralize(nights, "night")}
          </>
        }
        actions={
          <>
            {canCheckIn && (
              <ActionButton
                action={checkInAction.bind(null, r.id, roomDirty)}
                confirm={roomDirty ? `Room ${r.room?.number} is not clean yet. Check in anyway?` : undefined}
              >
                <LogIn /> Check in
              </ActionButton>
            )}
            {canCheckOut && (
              <ActionButton
                action={checkOutAction.bind(null, r.id)}
                variant="gold"
                confirm={
                  groupBill && othersStaying > 0
                    ? `Check out room ${r.room?.number ?? ""}${t < r.checkOut ? " early" : ""}? Its charges stay on group bill ${r.group?.code}.`
                    : `Check out ${r.guest.firstName} ${r.guest.lastName}${t < r.checkOut ? " early" : ""}?`
                }
              >
                <LogOut /> Check out
              </ActionButton>
            )}
            {active && (
              <ModifyStayDialog
                id={r.id}
                inHouse={r.status === "CHECKED_IN"}
                values={{ checkIn: toISODate(r.checkIn), checkOut: toISODate(r.checkOut), adults: r.adults, children: r.children, roomTypeId: r.roomTypeId }}
                roomTypes={roomTypes}
              />
            )}
            <EmailMenu id={r.id} status={r.status} hasEmail={!!r.guest.email} />
            {canNoShow && (
              <ActionButton action={noShowAction.bind(null, r.id)} variant="outline" confirm="Mark this reservation as a no-show? The first night will be charged.">
                <UserX /> No-show
              </ActionButton>
            )}
            {(r.status === "CONFIRMED" || r.status === "PENDING") && <CancelDialog id={r.id} />}
          </>
        }
      />

      {r.group && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold-soft/50 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-[#6d5326]">
            <Users className="size-4" />
            Part of group <span className="font-medium">{r.group.name}</span> ({r.group.code}) · {siblings.length} rooms:{" "}
            {siblings.map((x) => x.room?.number ?? "—").join(", ")}
            {groupBill && <> · one bill, group balance <span className="font-medium">{formatMoney(groupBill.balance)}</span></>}
          </span>
          <ButtonLink href={`/admin/groups/${r.group.id}`} size="sm" variant="outline">Open group</ButtonLink>
        </div>
      )}

      {roomDirty && canCheckIn && (
        <div className="mb-6 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning">
          Room {r.room?.number} is still marked as dirty. Ask housekeeping to prioritise it, or move the guest to a clean room.
        </div>
      )}

      <div className="grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Stay" />
            <CardBody className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Arrival</p>
                <p className="mt-1 font-medium">{formatLongDate(r.checkIn)}</p>
                <p className="text-sm text-muted-foreground">
                  {r.checkedInAt ? `Checked in ${formatDateTime(r.checkedInAt)}` : r.estimatedArrival ? `ETA ${r.estimatedArrival}` : "ETA not provided"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Departure</p>
                <p className="mt-1 font-medium">{formatLongDate(r.checkOut)}</p>
                <p className="text-sm text-muted-foreground">{r.checkedOutAt ? `Checked out ${formatDateTime(r.checkedOutAt)}` : pluralize(nights, "night")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Room</p>
                <div className="mt-1 flex items-center gap-2">
                  <BedDouble className="size-4 text-gold" />
                  <span className="font-medium">{r.room ? `Room ${r.room.number}` : "Unassigned"}</span>
                  {r.room && <RoomStatusBadge status={r.room.status} />}
                </div>
                <p className="text-sm text-muted-foreground">{r.roomType.name}</p>
                {active && <AssignRoomDialog id={r.id} currentRoomId={r.roomId} rooms={freeRooms.map((f) => ({ id: f.id, number: f.number, status: f.status }))} />}
              </div>
            </CardBody>
            <div className="border-t border-border px-5 py-4">
              <DescriptionList
                items={[
                  ["Guests", `${pluralize(r.adults, "adult")}${r.children ? `, ${pluralize(r.children, "child", "children")}` : ""}`],
                  ["Booking channel", SOURCE_LABEL[r.source]],
                  ...(r.promoCode ? ([["Promo code", r.promoCode]] as [string, string][]) : []),
                  ["Booked", `${formatDateTime(r.createdAt)}${r.createdBy ? ` by ${r.createdBy.name}` : " online"}`],
                  ...(r.cancelledAt ? ([["Cancelled", `${formatDateTime(r.cancelledAt)} — ${r.cancellationReason ?? ""}`]] as [string, string][]) : []),
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Folio"
              description="All charges are VAT-inclusive."
              action={editableFolio && can(user.role, "billing") ? <AddChargeDialog id={r.id} services={services.map((s) => ({ id: s.id, name: s.name, price: toNumber(s.price), category: s.category }))} /> : null}
            />
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Unit</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {r.charges.map((c) => (
                  <tr key={c.id} className={cn(c.voided && "text-muted-foreground")}>
                    <Td className="whitespace-nowrap">{formatDate(c.date)}</Td>
                    <Td>
                      <span className={cn(c.voided && "line-through")}>{c.description}</span>
                      {c.voided && <span className="ml-2 text-xs">Void — {c.voidReason}</span>}
                      {c.postedBy && !c.voided && <span className="ml-2 text-xs text-muted-foreground">by {c.postedBy.name}</span>}
                    </Td>
                    <Td className="text-right tabular-nums">{c.quantity}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(c.unitPrice)}</Td>
                    <Td className={cn("text-right font-medium tabular-nums", c.voided && "line-through")}>{formatMoney(c.amount)}</Td>
                    <Td>{!c.voided && editableFolio && can(user.role, "billing") && <VoidChargeButton chargeId={c.id} description={c.description} />}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex justify-end px-5 py-4">
              <dl className="w-64 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><dt>Net</dt><dd>{formatMoney(folio.net)}</dd></div>
                <div className="flex justify-between text-muted-foreground"><dt>VAT included</dt><dd>{formatMoney(folio.vat)}</dd></div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Total</dt><dd>{formatMoney(folio.total)}</dd></div>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Payments"
              action={
                can(user.role, "billing") ? (
                  <>
                    {can(user.role, "refunds") && folio.paid - folio.refunded > 0 && <RefundDialog id={r.id} max={folio.paid - folio.refunded} suggested={folio.balance < 0 ? -folio.balance : 0} />}
                    {!["CANCELLED"].includes(r.status) && <PaymentDialog id={r.id} balance={Math.max(folio.balance, 0)} />}
                  </>
                ) : null
              }
            />
            {r.payments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.payments.map((p) => (
                    <tr key={p.id}>
                      <Td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</Td>
                      <Td>
                        <Badge tone={p.kind === "REFUND" ? "violet" : "success"}>{p.kind === "REFUND" ? "Refund" : "Payment"}</Badge>
                      </Td>
                      <Td>
                        {PAYMENT_METHOD_LABEL[p.method]}
                        {p.cardLast4 && <span className="text-muted-foreground"> · {p.cardBrand} •••• {p.cardLast4}</span>}
                      </Td>
                      <Td className="max-w-48 truncate text-xs text-muted-foreground">
                        {p.providerRef ?? "—"}
                        {p.note && <span className="block">{p.note}</span>}
                      </Td>
                      <Td className="text-right font-medium tabular-nums">{p.kind === "REFUND" ? "−" : ""}{formatMoney(p.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ul className="divide-y divide-border">
              {[...history.map((h) => ({ at: h.createdAt, text: h.summary, who: h.user?.name ?? "Guest (online)" })), ...emails.map((e) => ({ at: e.createdAt, text: `Email "${e.subject}" ${e.status === "SENT" ? "sent" : "failed"} to ${e.to}`, who: "System" }))]
                .sort((a, b) => b.at.getTime() - a.at.getTime())
                .map((h, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                    <span>{h.text}</span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {h.who}
                      <br />
                      {formatDateTime(h.at)}
                    </span>
                  </li>
                ))}
              {history.length + emails.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">No activity recorded.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={cn(folio.balance > 0.004 ? "border-warning/40" : "")}>
            <CardBody>
              <p className="text-sm text-muted-foreground">{folio.balance < -0.004 ? "Guest credit" : "Balance due"}</p>
              <p className={cn("mt-1 text-3xl font-semibold tracking-tight", folio.balance > 0.004 ? "text-warning" : "text-success")}>{formatMoney(Math.abs(folio.balance))}</p>
              <DescriptionList
                className="mt-4"
                items={[
                  ["Total charges", formatMoney(folio.total)],
                  ["Paid", formatMoney(folio.paid)],
                  ...(folio.refunded ? ([["Refunded", formatMoney(folio.refunded)]] as [string, string][]) : []),
                ]}
              />
              <div className="mt-4 grid gap-2">
                <ButtonLink href={`/api/invoices/${r.code}?view`} target="_blank" variant="outline" prefetch={false}>
                  <Download /> {r.invoice ? `Invoice ${r.invoice.number}` : "Pro-forma invoice"}
                </ButtonLink>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Guest" action={<ButtonLink href={`/admin/guests/${r.guest.id}`} variant="ghost" size="sm">Profile</ButtonLink>} />
            <CardBody className="space-y-2 text-sm">
              <p className="font-medium">
                {r.guest.firstName} {r.guest.lastName}
                {r.guest.country && <span className="font-normal text-muted-foreground"> · {r.guest.country}</span>}
              </p>
              {r.guest.email && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" /> <a href={`mailto:${r.guest.email}`} className="hover:text-primary">{r.guest.email}</a>
                </p>
              )}
              {r.guest.phone && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4" /> {r.guest.phone}
                </p>
              )}
              {r.guest.notes && <p className="rounded-lg bg-gold-soft/60 px-3 py-2 text-[#7a5d2c]">{r.guest.notes}</p>}
              <Link href={`/admin/reservations?q=${encodeURIComponent(r.guest.email ?? r.guest.lastName)}`} className="inline-block text-xs text-primary underline-offset-4 hover:underline">
                See all stays
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Invoice to"
              action={!r.group && !r.invoice && can(user.role, "billing") ? <BillToDialog reservationId={r.id} current={r.companyId} companies={companies} /> : null}
            />
            <CardBody className="text-sm">
              {r.company ? (
                <Link href={`/admin/companies/${r.company.id}`} className="group flex items-start gap-3">
                  <Building2 className="mt-0.5 size-4 text-gold" />
                  <span>
                    <span className="font-medium group-hover:text-primary">{r.company.name}</span>
                    {r.company.taxId && <span className="block text-muted-foreground">NIPT {r.company.taxId}</span>}
                  </span>
                </Link>
              ) : (
                <p className="text-muted-foreground">The guest (private){r.group ? " — set on the group" : ""}.</p>
              )}
              {r.occupantName && <p className="mt-2 text-muted-foreground">Room guest: <span className="font-medium text-foreground">{r.occupantName}</span></p>}
            </CardBody>
          </Card>

          {(r.status === "CHECKED_OUT" || review) && (
            <Card>
              <CardHeader title="Guest review" action={review && can(user.role, "reviews") ? <ButtonLink href={`/admin/reviews?status=${review.status}`} variant="ghost" size="sm">Moderate</ButtonLink> : null} />
              <CardBody className="text-sm">
                {review ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Stars value={review.rating} size="md" />
                      <Badge tone={review.status === "PUBLISHED" ? "success" : review.status === "PENDING" ? "warning" : "neutral"}>{review.status.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-2 font-medium">“{review.title}”</p>
                    <p className="mt-1 line-clamp-4 text-muted-foreground">{review.body}</p>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-muted-foreground">No review yet. The check-out email invites the guest to rate their stay.</p>
                    {r.guest.email && can(user.role, "reviews") && (
                      <ActionButton size="sm" variant="outline" action={sendReviewRequestAction.bind(null, r.id)}>
                        <Star /> Send review request
                      </ActionButton>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Requests & notes" />
            <CardBody>
              <DetailsForm id={r.id} values={{ specialRequests: r.specialRequests ?? "", internalNotes: r.internalNotes ?? "", estimatedArrival: r.estimatedArrival ?? "" }} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
