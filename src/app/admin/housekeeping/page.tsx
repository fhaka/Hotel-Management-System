import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Play, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { PageHeader, StatCard } from "@/components/page-header";
import { PRIORITY, ROOM_STATUS, TASK_TYPE } from "@/components/status";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDateTime, formatLongDate, today } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { completeTaskAction, generateStayoversAction, reopenTaskAction, startTaskAction } from "./actions";
import { AssignDialog, NewTaskDialog } from "./dialogs";
import type { TaskStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Housekeeping" };

export default async function HousekeepingPage({ searchParams }: { searchParams: Promise<{ who?: string; floor?: string }> }) {
  const user = await requireStaff("housekeeping");
  const sp = await searchParams;
  const t = today();
  const mine = sp.who === "me" || (sp.who === undefined && user.role === "HOUSEKEEPING");
  const floor = Number(sp.floor) || undefined;

  const [tasks, staff, rooms, arrivalsToday] = await Promise.all([
    db.housekeepingTask.findMany({
      where: {
        OR: [{ dueDate: { lte: t }, status: { not: "DONE" } }, { dueDate: t, status: "DONE" }],
        ...(mine ? { assignedToId: user.id } : {}),
        ...(floor ? { room: { floor } } : {}),
      },
      include: { room: { include: { roomType: { select: { name: true } } } }, assignedTo: { select: { id: true, name: true } } },
      orderBy: [{ priority: "desc" }, { room: { number: "asc" } }],
    }),
    db.user.findMany({ where: { role: "HOUSEKEEPING", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.room.findMany({ where: { active: true }, select: { id: true, number: true, status: true, floor: true }, orderBy: { number: "asc" } }),
    db.reservation.findMany({ where: { checkIn: t, status: "CONFIRMED", roomId: { not: null } }, select: { roomId: true } }),
  ]);
  const arrivingRooms = new Set(arrivalsToday.map((a) => a.roomId));
  const columns: { status: TaskStatus; label: string }[] = [
    { status: "PENDING", label: "To do" },
    { status: "IN_PROGRESS", label: "In progress" },
    { status: "DONE", label: "Done today" },
  ];
  const floors = [...new Set(rooms.map((r) => r.floor))];
  const dirty = rooms.filter((r) => r.status === "DIRTY").length;
  const managerView = can(user.role, "frontDesk");
  const link = (p: { who?: string; floor?: string }) => {
    const qs = new URLSearchParams({ ...(sp.who !== undefined ? { who: sp.who } : {}), ...(sp.floor ? { floor: sp.floor } : {}), ...p });
    for (const [k, v] of [...qs]) if (!v) qs.delete(k);
    return `/admin/housekeeping?${qs}`;
  };

  return (
    <>
      <PageHeader
        title="Housekeeping"
        description={formatLongDate(t)}
        actions={
          <>
            <ActionButton variant="outline" action={generateStayoversAction}>
              <Wand2 /> Generate stayovers
            </ActionButton>
            <NewTaskDialog rooms={rooms.map((r) => ({ id: r.id, number: r.number }))} staff={staff} />
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Dirty rooms" value={dirty} accent="warning" icon={<Sparkles />} />
        <StatCard label="Clean / inspected" value={rooms.filter((r) => r.status === "CLEAN" || r.status === "INSPECTED").length} accent="success" />
        <StatCard label="Out of order" value={rooms.filter((r) => r.status === "OUT_OF_ORDER").length} accent="gold" />
        <StatCard label="Open tasks" value={tasks.filter((x) => x.status !== "DONE").length} hint={`${tasks.filter((x) => x.status === "DONE").length} completed today`} accent="info" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={link({ who: "all" })} className={cn("rounded-full border px-3 py-1.5", !mine ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}>All tasks</Link>
        <Link href={link({ who: "me" })} className={cn("rounded-full border px-3 py-1.5", mine ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}>My tasks</Link>
        <span className="mx-2 w-px bg-border" />
        <Link href={link({ floor: "" })} className={cn("rounded-full border px-3 py-1.5", !floor ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}>All floors</Link>
        {floors.map((f) => (
          <Link key={f} href={link({ floor: String(f) })} className={cn("rounded-full border px-3 py-1.5", floor === f ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}>Floor {f}</Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {columns.map((col) => {
          const items = tasks.filter((x) => x.status === col.status);
          return (
            <div key={col.status} className="rounded-xl bg-muted/50 p-3">
              <p className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                {col.label} <span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
              </p>
              <div className="space-y-2.5">
                {items.length === 0 && <EmptyState title="Nothing here" className="py-8" />}
                {items.map((task) => (
                  <Card key={task.id} className={cn("p-3.5", task.status === "DONE" && "opacity-70")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-2 text-lg font-semibold leading-none">
                          {task.room.number}
                          <span className={`size-2 rounded-full ${ROOM_STATUS[task.room.status].dot}`} title={ROOM_STATUS[task.room.status].label} />
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{task.room.roomType.name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={task.type === "MAINTENANCE" ? "danger" : task.type === "CHECKOUT_CLEAN" ? "warning" : "info"}>{TASK_TYPE[task.type]}</Badge>
                        {task.priority !== "NORMAL" && <Badge tone={PRIORITY[task.priority].tone}>{PRIORITY[task.priority].label} priority</Badge>}
                      </div>
                    </div>
                    {arrivingRooms.has(task.roomId) && task.status !== "DONE" && <p className="mt-2 rounded-md bg-gold-soft px-2 py-1 text-xs font-medium text-[#7a5d2c]">Guest arriving today — prioritise</p>}
                    {task.notes && <p className="mt-2 text-sm text-muted-foreground">{task.notes}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {task.status === "DONE" && task.completedAt ? `Done ${formatDateTime(task.completedAt).split(", ").pop()}` : task.assignedTo?.name ?? "Unassigned"}
                      </span>
                      <div className="flex gap-1.5">
                        {managerView && task.status !== "DONE" && (
                          <AssignDialog id={task.id} staff={staff} values={{ assignedToId: task.assignedTo?.id ?? "", priority: task.priority, notes: task.notes ?? "" }} />
                        )}
                        {task.status === "PENDING" && (
                          <ActionButton size="sm" variant="outline" action={startTaskAction.bind(null, task.id)}>
                            <Play /> Start
                          </ActionButton>
                        )}
                        {task.status !== "DONE" ? (
                          <ActionButton size="sm" action={completeTaskAction.bind(null, task.id)}>
                            <CheckCircle2 /> Done
                          </ActionButton>
                        ) : (
                          <ActionButton size="sm" variant="ghost" action={reopenTaskAction.bind(null, task.id)}>
                            <RotateCcw /> Reopen
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
