import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, BookOpenCheck, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ROOM_STATUS, ReservationStatusBadge } from "@/components/status";
import { Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireStaff();
  const q = ((await searchParams).q ?? "").trim();
  const parts = q.split(/\s+/).filter(Boolean);
  const nameMatch = parts.map((p) => ({
    OR: [
      { firstName: { contains: p, mode: "insensitive" as const } },
      { lastName: { contains: p, mode: "insensitive" as const } },
      { email: { contains: p, mode: "insensitive" as const } },
      { phone: { contains: p } },
    ],
  }));
  const front = can(user.role, "reservations");
  const [guests, reservations, rooms] = q
    ? await Promise.all([
        front ? db.guest.findMany({ where: { AND: nameMatch }, take: 8, orderBy: { lastName: "asc" } }) : [],
        front
          ? db.reservation.findMany({
              where: { OR: [{ code: { contains: q, mode: "insensitive" } }, { guest: { AND: nameMatch } }] },
              include: { guest: true, room: true },
              orderBy: { checkIn: "desc" },
              take: 10,
            })
          : [],
        db.room.findMany({ where: { number: { startsWith: q } }, include: { roomType: true }, take: 8, orderBy: { number: "asc" } }),
      ])
    : [[], [], []];

  return (
    <>
      <PageHeader title={q ? `Results for “${q}”` : "Search"} />
      {!q || guests.length + reservations.length + rooms.length === 0 ? (
        <Card><EmptyState icon={<Search />} title={q ? "No matches" : "Type in the search bar above"} description="Search guests by name, email or phone, bookings by confirmation number, or rooms by number." /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {reservations.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader title={<span className="flex items-center gap-2"><BookOpenCheck className="size-4 text-gold" /> Reservations</span>} />
              <ul className="divide-y divide-border">
                {reservations.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/reservations/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface/60">
                      <div>
                        <p className="text-sm font-medium">{r.guest.firstName} {r.guest.lastName} <span className="font-mono text-xs text-muted-foreground">{r.code}</span></p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}{r.room ? ` · Room ${r.room.number}` : ""}</p>
                      </div>
                      <ReservationStatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <div className="space-y-6">
            {guests.length > 0 && (
              <Card>
                <CardHeader title={<span className="flex items-center gap-2"><Users className="size-4 text-gold" /> Guests</span>} />
                <ul className="divide-y divide-border">
                  {guests.map((g) => (
                    <li key={g.id}>
                      <Link href={`/admin/guests/${g.id}`} className="block px-5 py-3 hover:bg-surface/60">
                        <p className="text-sm font-medium">{g.firstName} {g.lastName}</p>
                        <p className="text-xs text-muted-foreground">{g.email ?? g.phone}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {rooms.length > 0 && (
              <Card>
                <CardHeader title={<span className="flex items-center gap-2"><BedDouble className="size-4 text-gold" /> Rooms</span>} />
                <ul className="divide-y divide-border">
                  {rooms.map((r) => (
                    <li key={r.id}>
                      <Link href={front ? `/admin/calendar?type=${r.roomTypeId}` : "/admin/rooms"} className="flex items-center justify-between px-5 py-3 hover:bg-surface/60">
                        <span className="text-sm font-medium">Room {r.number} <span className="font-normal text-muted-foreground">· {r.roomType.name}</span></span>
                        <span className="flex items-center gap-1.5 text-xs"><span className={`size-2 rounded-full ${ROOM_STATUS[r.status].dot}`} /> {ROOM_STATUS[r.status].label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
