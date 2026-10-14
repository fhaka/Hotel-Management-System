"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Settings2, Wrench } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { ROOM_STATUS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { saveRoomAction, setRoomStatusAction } from "./actions";

type RoomStatus = keyof typeof ROOM_STATUS;
type Room = { id: string; number: string; floor: number; status: RoomStatus; typeId: string; typeName: string; notes: string | null; reason: string | null; active: boolean };

const TILE: Record<RoomStatus, string> = {
  CLEAN: "border-success/30 bg-success-soft/40",
  INSPECTED: "border-info/30 bg-info-soft/40",
  DIRTY: "border-warning/30 bg-warning-soft/50",
  OUT_OF_ORDER: "border-danger/30 bg-danger-soft/50",
};

export function RoomTile({
  room,
  occupant,
  arrival,
  canManage,
  roomTypes,
}: {
  room: Room;
  occupant: { id: string; name: string; until: string } | null;
  arrival: { id: string; name: string } | null;
  canManage: boolean;
  roomTypes: { id: string; name: string }[];
}) {
  return (
    <div className={cn("relative flex flex-col rounded-xl border p-3", TILE[room.status], !room.active && "opacity-50")}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold leading-none">{room.number}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{room.typeName}</p>
        </div>
        <StatusDialog room={room} />
      </div>
      <div className="mt-3 min-h-9 text-xs">
        {occupant ? (
          <Link href={`/admin/reservations/${occupant.id}`} className="block truncate font-medium text-foreground hover:text-primary">
            {occupant.name}
            <span className="block font-normal text-muted-foreground">until {occupant.until}</span>
          </Link>
        ) : arrival ? (
          <Link href={`/admin/reservations/${arrival.id}`} className="block truncate text-info hover:underline">
            Arriving: {arrival.name}
          </Link>
        ) : room.status === "OUT_OF_ORDER" ? (
          <p className="flex items-start gap-1 text-danger"><Wrench className="mt-0.5 size-3 shrink-0" /> {room.reason}</p>
        ) : (
          <p className="text-muted-foreground">Vacant</p>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className={`size-1.5 rounded-full ${ROOM_STATUS[room.status].dot}`} /> {ROOM_STATUS[room.status].label}
        </span>
        {canManage && <EditRoomDialog room={room} roomTypes={roomTypes} />}
      </div>
    </div>
  );
}

function StatusDialog({ room }: { room: Room }) {
  const [status, setStatus] = useState<RoomStatus>(room.status);
  return (
    <FormDialog
      trigger={
        <button className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-white/70 hover:text-foreground" aria-label={`Change status of room ${room.number}`}>
          <Settings2 className="size-4" />
        </button>
      }
      title={`Room ${room.number}`}
      description={`${room.typeName} · Floor ${room.floor}`}
      action={setRoomStatusAction.bind(null, room.id)}
      submitLabel="Update room"
    >
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ROOM_STATUS) as RoomStatus[]).map((s) => (
          <label key={s} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm", status === s ? "border-primary ring-1 ring-primary" : "border-border")}>
            <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
            <span className={`size-2 rounded-full ${ROOM_STATUS[s].dot}`} /> {ROOM_STATUS[s].label}
          </label>
        ))}
      </div>
      {status === "OUT_OF_ORDER" && (
        <Field label="Reason" htmlFor={`reason-${room.id}`}>
          <Input id={`reason-${room.id}`} name="reason" defaultValue={room.reason ?? ""} placeholder="E.g. Leaking shower — plumber booked" required />
        </Field>
      )}
      <Field label="Room notes" htmlFor={`notes-${room.id}`}>
        <Textarea id={`notes-${room.id}`} name="notes" defaultValue={room.notes ?? ""} rows={2} />
      </Field>
    </FormDialog>
  );
}

function EditRoomDialog({ room, roomTypes }: { room: Room; roomTypes: { id: string; name: string }[] }) {
  return (
    <FormDialog
      trigger={<button className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline">Edit</button>}
      title={`Edit room ${room.number}`}
      action={saveRoomAction.bind(null, room.id)}
    >
      <RoomFields room={room} roomTypes={roomTypes} />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="active" defaultChecked={room.active} /> Room is in service (bookable)
      </label>
    </FormDialog>
  );
}

function RoomFields({ room, roomTypes }: { room?: Room; roomTypes: { id: string; name: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Room number" htmlFor="rf-num"><Input id="rf-num" name="number" defaultValue={room?.number} required /></Field>
      <Field label="Floor" htmlFor="rf-floor"><Input id="rf-floor" name="floor" type="number" min={0} defaultValue={room?.floor ?? 1} required /></Field>
      <Field label="Room type" htmlFor="rf-type" className="col-span-2">
        <Select id="rf-type" name="roomTypeId" defaultValue={room?.typeId ?? roomTypes[0]?.id}>
          {roomTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
    </div>
  );
}

export function AddRoomDialog({ roomTypes }: { roomTypes: { id: string; name: string }[] }) {
  return (
    <FormDialog trigger={<Button><Plus /> Add room</Button>} title="Add a room" action={saveRoomAction.bind(null, null)} submitLabel="Add room">
      <RoomFields roomTypes={roomTypes} />
    </FormDialog>
  );
}
