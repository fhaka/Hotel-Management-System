"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { isISODate, parseISODate, today } from "@/lib/dates";
import { BookingError } from "@/lib/reservations";

const refresh = () => revalidatePath("/admin", "layout");

export async function setRoomStatusAction(roomId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("housekeeping");
    const d = z
      .object({ status: z.enum(["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"]), reason: z.string().trim().max(200).optional(), notes: z.string().trim().max(500).optional() })
      .parse(Object.fromEntries(formData));
    if (d.status === "OUT_OF_ORDER") {
      if (!can(user.role, "manageRooms") && user.role !== "RECEPTIONIST") throw new BookingError("Only managers and reception can take a room out of order.");
      if (!d.reason) throw new BookingError("Enter a reason for taking the room out of order.");
    }
    const room = await db.room.update({
      where: { id: roomId },
      data: { status: d.status, outOfOrderReason: d.status === "OUT_OF_ORDER" ? d.reason : null, notes: d.notes || null },
    });
    if (d.status === "OUT_OF_ORDER") {
      await db.housekeepingTask.create({ data: { roomId, type: "MAINTENANCE", priority: "HIGH", dueDate: today(), notes: d.reason } });
    }
    await audit({ userId: user.id, action: "room.status", entity: "Room", entityId: roomId, summary: `Set room ${room.number} to ${d.status.replace("_", " ").toLowerCase()}${d.reason && d.status === "OUT_OF_ORDER" ? `: ${d.reason}` : ""}` });
    refresh();
    return `Room ${room.number} updated.`;
  });
}

export async function saveRoomAction(roomId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const d = z
      .object({ number: z.string().trim().regex(/^\d{3,4}$/, "Room number must be 3–4 digits"), floor: z.coerce.number().int().min(0).max(50), roomTypeId: z.string().min(1), active: z.string().optional() })
      .parse(Object.fromEntries(formData));
    const clash = await db.room.findUnique({ where: { number: d.number } });
    if (clash && clash.id !== roomId) throw new BookingError(`Room ${d.number} already exists.`);
    const data = { number: d.number, floor: d.floor, roomTypeId: d.roomTypeId, active: roomId ? d.active === "on" : true };
    if (roomId) {
      const current = await db.room.findUniqueOrThrow({ where: { id: roomId } });
      if (current.roomTypeId !== d.roomTypeId) {
        const future = await db.reservation.count({ where: { roomId, status: { in: ["CONFIRMED", "PENDING", "CHECKED_IN"] } } });
        if (future) throw new BookingError(`Room ${current.number} has ${future} active reservation(s). Move them before changing its type.`);
      }
      await db.room.update({ where: { id: roomId }, data });
    } else {
      await db.room.create({ data });
    }
    await audit({ userId: user.id, action: roomId ? "room.update" : "room.create", entity: "Room", entityId: roomId, summary: `${roomId ? "Updated" : "Added"} room ${d.number}` });
    refresh();
    return `Room ${d.number} saved.`;
  });
}

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

export async function saveRoomTypeAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const d = z
      .object({
        name: z.string().trim().min(2).max(60),
        tagline: z.string().trim().max(120),
        description: z.string().trim().min(10).max(2000),
        baseRate: z.coerce.number().positive("Base rate must be positive"),
        weekendRate: z.union([z.literal(""), z.coerce.number().positive()]),
        maxAdults: z.coerce.number().int().min(1).max(10),
        maxChildren: z.coerce.number().int().min(0).max(10),
        sizeSqm: z.coerce.number().int().min(5).max(1000),
        bedType: z.string().trim().min(2).max(60),
        view: z.string().trim().max(60),
        amenities: z.string(),
        images: z.string(),
        active: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));
    const images = lines(d.images);
    if (images.length === 0) throw new BookingError("Add at least one image URL.");
    if (images.some((u) => !/^https:\/\/images\.unsplash\.com\//.test(u) && !u.startsWith("/"))) throw new BookingError("Images must be hosted on images.unsplash.com or in /public.");
    const rt = await db.roomType.update({
      where: { id },
      data: {
        name: d.name,
        tagline: d.tagline,
        description: d.description,
        baseRate: d.baseRate,
        weekendRate: d.weekendRate === "" ? null : d.weekendRate,
        maxAdults: d.maxAdults,
        maxChildren: d.maxChildren,
        sizeSqm: d.sizeSqm,
        bedType: d.bedType,
        view: d.view,
        amenities: lines(d.amenities),
        images,
        active: d.active === "on",
      },
    });
    await audit({ userId: user.id, action: "roomtype.update", entity: "RoomType", entityId: id, summary: `Updated ${rt.name} (base rate €${d.baseRate})` });
    revalidatePath("/", "layout");
    return `${rt.name} saved.`;
  });
}

export async function saveSeasonAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const d = z
      .object({
        name: z.string().trim().min(2).max(60),
        startDate: z.string().refine(isISODate, "Invalid start date"),
        endDate: z.string().refine(isISODate, "Invalid end date"),
        multiplier: z.coerce.number().min(0.3).max(3),
        roomTypeId: z.string().optional(),
      })
      .refine((x) => x.endDate > x.startDate, { message: "End must be after start", path: ["endDate"] })
      .parse(Object.fromEntries(formData));
    await db.seasonalRate.create({
      data: { name: d.name, startDate: parseISODate(d.startDate), endDate: parseISODate(d.endDate), multiplier: d.multiplier, roomTypeId: d.roomTypeId || null },
    });
    await audit({ userId: user.id, action: "season.create", entity: "SeasonalRate", summary: `Added season "${d.name}" ×${d.multiplier} (${d.startDate} → ${d.endDate})` });
    revalidatePath("/", "layout");
    return "Season added. New bookings use it immediately.";
  });
}

export async function deleteSeasonAction(id: string): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageRooms");
    const s = await db.seasonalRate.delete({ where: { id } });
    await audit({ userId: user.id, action: "season.delete", entity: "SeasonalRate", entityId: id, summary: `Removed season "${s.name}"` });
    revalidatePath("/", "layout");
    return "Season removed.";
  });
}
