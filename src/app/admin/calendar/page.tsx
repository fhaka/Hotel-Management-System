import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ROOM_STATUS } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addDays, addDaysISO, formatShortDate, formatWeekday, isISODate, nightsBetween, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ReservationStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Room calendar" };

const DAYS = 14;
const COL = 64; // px per night
const BLOCK: Record<ReservationStatus, string> = {
  PENDING: "bg-warning-soft text-warning border-warning/30",
  CONFIRMED: "bg-info-soft text-info border-info/30",
  CHECKED_IN: "bg-success text-white border-success",
  CHECKED_OUT: "bg-muted text-muted-foreground border-border",
  CANCELLED: "",
  NO_SHOW: "bg-violet-soft text-violet border-violet/30",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ start?: string; type?: string }> }) {
  await requireStaff("reservations");
  const sp = await searchParams;
  const today = todayISO();
  const startISO = isISODate(sp.start) ? sp.start : addDaysISO(today, -2);
  const start = parseISODate(startISO);
  const end = addDays(start, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  const [roomTypes, rooms, reservations] = await Promise.all([
    db.roomType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.room.findMany({ where: { active: true, ...(sp.type ? { roomTypeId: sp.type } : {}) }, include: { roomType: { select: { name: true } } }, orderBy: [{ floor: "asc" }, { number: "asc" }] }),
    db.reservation.findMany({
      where: { roomId: { not: null }, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"] }, checkIn: { lt: end }, checkOut: { gt: start } },
      select: { id: true, roomId: true, checkIn: true, checkOut: true, status: true, guest: { select: { firstName: true, lastName: true, vip: true } } },
    }),
  ]);
  const byRoom = new Map<string, typeof reservations>();
  for (const r of reservations) byRoom.set(r.roomId!, [...(byRoom.get(r.roomId!) ?? []), r]);
  const floors = [...new Set(rooms.map((r) => r.floor))];
  const occupiedPerDay = days.map((d) => reservations.filter((r) => r.status !== "NO_SHOW" && r.checkIn <= d && r.checkOut > d).length);
  const nav = (s: string) => `/admin/calendar?start=${s}${sp.type ? `&type=${sp.type}` : ""}`;

  return (
    <>
      <PageHeader
        title="Room calendar"
        description={`${formatShortDate(start)} – ${formatShortDate(addDays(end, -1))} · click an empty night to create a booking`}
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href={nav(addDaysISO(startISO, -7))} variant="outline" size="icon" aria-label="Previous week"><ChevronLeft /></ButtonLink>
            <ButtonLink href={nav(addDaysISO(today, -2))} variant="outline">Today</ButtonLink>
            <ButtonLink href={nav(addDaysISO(startISO, 7))} variant="outline" size="icon" aria-label="Next week"><ChevronRight /></ButtonLink>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/calendar?start=${startISO}`} className={cn("rounded-full border px-3 py-1.5 text-sm", !sp.type ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}>All rooms</Link>
          {roomTypes.map((t) => (
            <Link key={t.id} href={`/admin/calendar?start=${startISO}&type=${t.id}`} className={cn("rounded-full border px-3 py-1.5 text-sm", sp.type === t.id ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted")}>
              {t.name}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded border", BLOCK[s])} />
              {{ CONFIRMED: "Confirmed", CHECKED_IN: "In house", CHECKED_OUT: "Departed", NO_SHOW: "No-show" }[s]}
            </span>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <div style={{ minWidth: 160 + COL * DAYS }}>
            {/* Header */}
            <div className="sticky top-0 z-10 flex border-b border-border bg-white">
              <div className="sticky left-0 z-10 w-40 shrink-0 border-r border-border bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Room</div>
              {days.map((d, i) => {
                const iso = toISODate(d);
                const weekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
                return (
                  <div key={iso} style={{ width: COL }} className={cn("shrink-0 border-r border-border px-1 py-1.5 text-center", iso === today && "bg-gold-soft", weekend && iso !== today && "bg-surface/70")}>
                    <p className="text-[0.65rem] uppercase text-muted-foreground">{formatWeekday(d)}</p>
                    <p className={cn("text-sm font-semibold", iso === today && "text-[#8a6a32]")}>{d.getUTCDate()}</p>
                    <p className="text-[0.6rem] text-muted-foreground">{Math.round((occupiedPerDay[i]! / Math.max(rooms.length, 1)) * 100)}%</p>
                  </div>
                );
              })}
            </div>
            {floors.map((floor) => (
              <div key={floor}>
                <div className="sticky left-0 border-b border-border bg-surface px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Floor {floor}</div>
                {rooms
                  .filter((r) => r.floor === floor)
                  .map((room) => (
                    <div key={room.id} className="relative flex h-11 border-b border-border">
                      <div className="sticky left-0 z-[5] flex w-40 shrink-0 items-center gap-2 border-r border-border bg-white px-4">
                        <span className={`size-2 rounded-full ${ROOM_STATUS[room.status].dot}`} title={ROOM_STATUS[room.status].label} />
                        <span className="text-sm font-semibold">{room.number}</span>
                        <span className="truncate text-xs text-muted-foreground">{room.roomType.name}</span>
                      </div>
                      {days.map((d) => {
                        const iso = toISODate(d);
                        return (
                          <Link
                            key={iso}
                            href={`/admin/reservations/new?checkIn=${iso}&roomTypeId=${room.roomTypeId}`}
                            style={{ width: COL }}
                            className={cn("shrink-0 border-r border-border/70 hover:bg-gold-soft/50", iso === today && "bg-gold-soft/30", room.status === "OUT_OF_ORDER" && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(180,35,24,0.07)_6px,rgba(180,35,24,0.07)_12px)]")}
                            aria-label={`New booking in room ${room.number} on ${iso}`}
                          />
                        );
                      })}
                      {(byRoom.get(room.id) ?? []).map((r) => {
                        const from = r.checkIn < start ? start : r.checkIn;
                        const to = r.checkOut > end ? end : r.checkOut;
                        const left = 160 + nightsBetween(start, from) * COL + (r.checkIn < start ? 0 : COL / 2);
                        const width = nightsBetween(from, to) * COL - (r.checkIn < start ? 0 : COL / 2) + (r.checkOut > end ? 0 : COL / 2) - 4;
                        return (
                          <Link
                            key={r.id}
                            href={`/admin/reservations/${r.id}`}
                            style={{ left: left + 2, width: Math.max(width, 18) }}
                            className={cn("absolute top-1.5 z-[4] flex h-8 items-center overflow-hidden rounded-md border px-2 text-xs font-medium shadow-sm transition-transform hover:-translate-y-px hover:shadow", BLOCK[r.status])}
                            title={`${r.guest.firstName} ${r.guest.lastName} · ${toISODate(r.checkIn)} → ${toISODate(r.checkOut)}`}
                          >
                            <span className="truncate">
                              {r.guest.vip && "★ "}
                              {r.guest.lastName}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
