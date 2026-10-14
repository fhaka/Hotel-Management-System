"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { BookingError } from "@/lib/reservations";
import { TASK_TYPE } from "@/components/status";

const refresh = () => revalidatePath("/admin", "layout");

export async function startTaskAction(id: string): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("housekeeping");
    const task = await db.housekeepingTask.update({ where: { id }, data: { status: "IN_PROGRESS", assignedToId: undefined }, include: { room: true } });
    if (!task.assignedToId && user.role === "HOUSEKEEPING") await db.housekeepingTask.update({ where: { id }, data: { assignedToId: user.id } });
    refresh();
    return `Started room ${task.room.number}.`;
  });
}

export async function completeTaskAction(id: string): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("housekeeping");
    const task = await db.housekeepingTask.findUniqueOrThrow({ where: { id }, include: { room: true } });
    if (task.status === "DONE") throw new BookingError("This task is already done.");
    await db.$transaction(async (tx) => {
      await tx.housekeepingTask.update({ where: { id }, data: { status: "DONE", completedAt: new Date(), assignedToId: task.assignedToId ?? user.id } });
      // Completing a task moves the room forward in the housekeeping cycle.
      let status = task.room.status;
      if (task.type === "INSPECTION") status = "INSPECTED";
      else if (task.type === "MAINTENANCE") status = task.room.status === "OUT_OF_ORDER" ? "DIRTY" : task.room.status;
      else if (task.room.status !== "OUT_OF_ORDER") status = "CLEAN";
      await tx.room.update({ where: { id: task.roomId }, data: { status, outOfOrderReason: status === "OUT_OF_ORDER" ? task.room.outOfOrderReason : null } });
      if (task.type === "MAINTENANCE" && task.room.status === "OUT_OF_ORDER") {
        await tx.housekeepingTask.create({ data: { roomId: task.roomId, type: "CHECKOUT_CLEAN", priority: "HIGH", dueDate: today(), notes: "Clean after maintenance" } });
      }
      await audit({ userId: user.id, action: "task.complete", entity: "Room", entityId: task.roomId, summary: `${TASK_TYPE[task.type]} completed in room ${task.room.number}` }, tx);
    });
    refresh();
    return `Room ${task.room.number} — ${TASK_TYPE[task.type].toLowerCase()} done.`;
  });
}

export async function reopenTaskAction(id: string): Promise<ActionState> {
  return attempt(async () => {
    await assertPermission("housekeeping");
    await db.housekeepingTask.update({ where: { id }, data: { status: "PENDING", completedAt: null } });
    refresh();
    return "Task reopened.";
  });
}

export async function assignTaskAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("frontDesk");
    const d = z.object({ assignedToId: z.string(), priority: z.enum(["LOW", "NORMAL", "HIGH"]), notes: z.string().max(300) }).parse(Object.fromEntries(formData));
    await db.housekeepingTask.update({ where: { id }, data: { assignedToId: d.assignedToId || null, priority: d.priority, notes: d.notes || null } });
    await audit({ userId: user.id, action: "task.assign", entity: "HousekeepingTask", entityId: id, summary: "Updated housekeeping task assignment" });
    refresh();
    return "Task updated.";
  });
}

export async function createTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("housekeeping");
    const d = z
      .object({
        roomId: z.string().min(1, "Select a room"),
        type: z.enum(["CHECKOUT_CLEAN", "STAYOVER", "INSPECTION", "MAINTENANCE", "TURNDOWN"]),
        priority: z.enum(["LOW", "NORMAL", "HIGH"]),
        assignedToId: z.string().optional(),
        notes: z.string().max(300).optional(),
      })
      .parse(Object.fromEntries(formData));
    const room = await db.room.findUniqueOrThrow({ where: { id: d.roomId } });
    await db.housekeepingTask.create({ data: { roomId: d.roomId, type: d.type, priority: d.priority, assignedToId: d.assignedToId || null, notes: d.notes || null, dueDate: today() } });
    await audit({ userId: user.id, action: "task.create", entity: "Room", entityId: d.roomId, summary: `Created ${TASK_TYPE[d.type].toLowerCase()} task for room ${room.number}` });
    refresh();
    return `Task created for room ${room.number}.`;
  });
}

/** Creates a stayover service task for every occupied room that has no open task today. */
export async function generateStayoversAction(): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("housekeeping");
    const t = today();
    const occupied = await db.reservation.findMany({ where: { status: "CHECKED_IN", checkOut: { gt: t }, roomId: { not: null } }, select: { roomId: true } });
    const existing = await db.housekeepingTask.findMany({ where: { dueDate: t, roomId: { in: occupied.map((o) => o.roomId!) } }, select: { roomId: true } });
    const have = new Set(existing.map((e) => e.roomId));
    const todo = occupied.filter((o) => !have.has(o.roomId!));
    const staff = await db.user.findMany({ where: { role: "HOUSEKEEPING", active: true }, select: { id: true } });
    await db.housekeepingTask.createMany({
      data: todo.map((o, i) => ({ roomId: o.roomId!, type: "STAYOVER" as const, dueDate: t, assignedToId: staff.length ? staff[i % staff.length]!.id : null })),
    });
    await audit({ userId: user.id, action: "task.generate", entity: "HousekeepingTask", summary: `Generated ${todo.length} stayover tasks` });
    refresh();
    return todo.length ? `Created ${todo.length} stayover tasks, shared across the team.` : "Every occupied room already has a task today.";
  });
}
