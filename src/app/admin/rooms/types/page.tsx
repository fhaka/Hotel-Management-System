import type { Metadata } from "next";
import Image from "next/image";
import { Badge, Card } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/format";
import { EditRoomTypeDialog } from "./edit-dialog";

export const metadata: Metadata = { title: "Room types & rates" };

export default async function RoomTypesPage() {
  await requireStaff("manageRooms");
  const types = await db.roomType.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { rooms: true } } } });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {types.map((t) => (
        <Card key={t.id} className="overflow-hidden">
          <div className="grid sm:grid-cols-[200px_1fr]">
            <div className="relative aspect-[16/10] sm:aspect-auto">
              <Image src={t.images[0]!} alt={t.name} fill sizes="200px" className="object-cover" />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl text-primary">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.tagline}</p>
                </div>
                {!t.active && <Badge tone="danger">Hidden</Badge>}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Weekday</dt><dd className="font-semibold">{formatMoney(t.baseRate)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Fri & Sat</dt><dd className="font-semibold">{t.weekendRate ? formatMoney(t.weekendRate) : "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Rooms</dt><dd className="font-semibold">{t._count.rooms}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Occupancy</dt><dd>{t.maxAdults} + {t.maxChildren}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Size</dt><dd>{t.sizeSqm} m²</dd></div>
                <div><dt className="text-xs text-muted-foreground">Bed</dt><dd className="truncate">{t.bedType}</dd></div>
              </dl>
              <div className="mt-4">
                <EditRoomTypeDialog
                  id={t.id}
                  values={{
                    name: t.name,
                    tagline: t.tagline,
                    description: t.description,
                    baseRate: toNumber(t.baseRate),
                    weekendRate: t.weekendRate ? toNumber(t.weekendRate) : null,
                    maxAdults: t.maxAdults,
                    maxChildren: t.maxChildren,
                    sizeSqm: t.sizeSqm,
                    bedType: t.bedType,
                    view: t.view,
                    amenities: t.amenities.join("\n"),
                    images: t.images.join("\n"),
                    active: t.active,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
