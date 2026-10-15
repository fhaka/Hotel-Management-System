import type { Metadata } from "next";
import { Ban, Pause, Play, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { describeRestriction, lastNight } from "@/lib/booking-rules";
import { db } from "@/lib/db";
import { formatDate, toISODate, today } from "@/lib/dates";
import { deleteRuleAction, toggleRuleAction } from "../pricing-actions";
import { RuleDialog } from "../pricing-dialogs";

export const metadata: Metadata = { title: "Booking rules" };

export default async function BookingRulesPage() {
  await requireStaff("manageRooms");
  const t = today();
  const [rules, roomTypes] = await Promise.all([
    db.stayRestriction.findMany({ include: { roomType: { select: { name: true } } }, orderBy: [{ startDate: "asc" }] }),
    db.roomType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <Card>
      <CardHeader
        title="Booking rules"
        description="Minimum stays, closed-to-arrival dates and stop-sells for online bookings. Staff bookings are warned but not blocked."
        action={<RuleDialog roomTypes={roomTypes} />}
      />
      {rules.length === 0 ? (
        <EmptyState icon={<Ban />} title="No booking rules" description="All dates are open for online booking with no minimum stay." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Rule</Th>
              <Th>Nights</Th>
              <Th>Applies to</Th>
              <Th>Effect</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const past = r.endDate <= t;
              return (
                <tr key={r.id} className={r.active && !past ? "" : "opacity-60"}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="whitespace-nowrap">{formatDate(r.startDate)} – {formatDate(lastNight(r))}</Td>
                  <Td>{r.roomType?.name ?? "All room types"}</Td>
                  <Td>
                    <span className={r.stopSell ? "font-medium text-danger" : ""}>{describeRestriction(r)}</span>
                  </Td>
                  <Td>{!r.active ? <Badge>Off</Badge> : past ? <Badge tone="neutral">Past</Badge> : r.startDate <= t ? <Badge tone="success" dot>In effect</Badge> : <Badge tone="info">Upcoming</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <ActionButton size="icon-sm" variant="ghost" action={toggleRuleAction.bind(null, r.id, !r.active)} aria-label={r.active ? `Disable ${r.name}` : `Enable ${r.name}`}>
                        {r.active ? <Pause /> : <Play />}
                      </ActionButton>
                      <RuleDialog
                        id={r.id}
                        roomTypes={roomTypes}
                        values={{ name: r.name, startDate: toISODate(r.startDate), endDate: toISODate(r.endDate), roomTypeId: r.roomTypeId ?? "", weekdays: r.weekdays, minNights: r.minNights, closedToArrival: r.closedToArrival, stopSell: r.stopSell }}
                      />
                      <ActionButton size="icon-sm" variant="ghost" action={deleteRuleAction.bind(null, r.id)} confirm={`Delete the rule "${r.name}"?`} aria-label={`Delete ${r.name}`}>
                        <Trash2 />
                      </ActionButton>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
