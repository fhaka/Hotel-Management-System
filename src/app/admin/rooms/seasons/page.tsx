import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addDays, formatDate, today } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import { deleteSeasonAction } from "../actions";
import { AddSeasonDialog } from "./add-dialog";

export const metadata: Metadata = { title: "Seasonal pricing" };

export default async function SeasonsPage() {
  await requireStaff("manageRooms");
  const [seasons, roomTypes] = await Promise.all([
    db.seasonalRate.findMany({ include: { roomType: { select: { name: true } } }, orderBy: { startDate: "asc" } }),
    db.roomType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const t = today();
  return (
    <Card>
      <CardHeader
        title="Seasons"
        description="A multiplier is applied to the nightly rate for nights inside the period (end date exclusive). A room-type season overrides a hotel-wide one."
        action={<AddSeasonDialog roomTypes={roomTypes} />}
      />
      {seasons.length === 0 ? (
        <EmptyState title="No seasons defined" description="All nights use the standard weekday/weekend rates." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Season</Th>
              <Th>Period</Th>
              <Th>Applies to</Th>
              <Th className="text-right">Adjustment</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => {
              const m = toNumber(s.multiplier);
              const state = s.endDate <= t ? "Past" : s.startDate <= t ? "Active" : "Upcoming";
              return (
                <tr key={s.id}>
                  <Td className="font-medium">
                    {s.name} <Badge tone={state === "Active" ? "success" : state === "Past" ? "neutral" : "info"} className="ml-2">{state}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(s.startDate)} – {formatDate(addDays(s.endDate, -1))}</Td>
                  <Td>{s.roomType?.name ?? "All room types"}</Td>
                  <Td className={`text-right font-medium tabular-nums ${m >= 1 ? "text-success" : "text-danger"}`}>
                    {m >= 1 ? "+" : "−"}{Math.abs(Math.round((m - 1) * 100))}%
                  </Td>
                  <Td className="text-right">
                    <ActionButton size="icon-sm" variant="ghost" action={deleteSeasonAction.bind(null, s.id)} confirm={`Delete season "${s.name}"?`} aria-label="Delete season">
                      <Trash2 />
                    </ActionButton>
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
