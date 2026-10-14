import type { Metadata } from "next";
import { ROOM_STATUS } from "@/components/status";
import { Card } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatShortDate, today } from "@/lib/dates";
import { AddRoomDialog, RoomTile } from "./room-tiles";

export const metadata: Metadata = { title: "Rooms" };

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireStaff("rooms");
  const { status } = await searchParams;
  const t = today();
  const [rooms, roomTypes, stays] = await Promise.all([
    db.room.findMany({ include: { roomType: { select: { id: true, name: true } } }, orderBy: [{ floor: "asc" }, { number: "asc" }] }),
    db.roomType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.reservation.findMany({
      where: { roomId: { not: null }, OR: [{ status: "CHECKED_IN" }, { status: "CONFIRMED", checkIn: t }] },
      select: { id: true, roomId: true, status: true, checkOut: true, guest: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const visible = status && status in ROOM_STATUS ? rooms.filter((r) => r.status === status) : rooms;
  const floors = [...new Set(visible.map((r) => r.floor))];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/admin/rooms" className={`rounded-full border px-3 py-1.5 ${!status ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>All {rooms.length}</a>
          {(Object.keys(ROOM_STATUS) as (keyof typeof ROOM_STATUS)[]).map((s) => (
            <a key={s} href={`/admin/rooms?status=${s}`} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${status === s ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>
              <span className={`size-2 rounded-full ${ROOM_STATUS[s].dot}`} /> {ROOM_STATUS[s].label} {rooms.filter((r) => r.status === s).length}
            </a>
          ))}
        </div>
        {can(user.role, "manageRooms") && <AddRoomDialog roomTypes={roomTypes} />}
      </div>
      <div className="space-y-6">
        {floors.map((floor) => (
          <Card key={floor} className="p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Floor {floor}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {visible
                .filter((r) => r.floor === floor)
                .map((room) => {
                  const stay = stays.find((s) => s.roomId === room.id && s.status === "CHECKED_IN");
                  const arrival = stays.find((s) => s.roomId === room.id && s.status === "CONFIRMED");
                  return (
                    <RoomTile
                      key={room.id}
                      room={{ id: room.id, number: room.number, floor: room.floor, status: room.status, typeId: room.roomTypeId, typeName: room.roomType.name, notes: room.notes, reason: room.outOfOrderReason, active: room.active }}
                      occupant={stay ? { id: stay.id, name: `${stay.guest.firstName} ${stay.guest.lastName}`, until: formatShortDate(stay.checkOut) } : null}
                      arrival={arrival ? { id: arrival.id, name: `${arrival.guest.firstName} ${arrival.guest.lastName}` } : null}
                      canManage={can(user.role, "manageRooms")}
                      roomTypes={roomTypes}
                    />
                  );
                })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
