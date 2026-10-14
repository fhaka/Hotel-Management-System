import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination, buildHref, pageParam } from "@/components/pagination";
import { Avatar, Card, EmptyState } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Activity log" };

const SIZE = 40;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string; user?: string }> }) {
  await requireStaff("audit");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const where = sp.user ? { userId: sp.user } : {};
  const [total, rows, users] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { user: { select: { id: true, name: true } } } }),
    db.user.findMany({ where: { role: { not: "GUEST" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Activity log" description="Every change made by staff, for accountability and troubleshooting." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/activity" className={`rounded-full border px-3 py-1.5 ${!sp.user ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>Everyone</Link>
        {users.map((u) => (
          <Link key={u.id} href={`/admin/activity?user=${u.id}`} className={`rounded-full border px-3 py-1.5 ${sp.user === u.id ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>{u.name}</Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title="No activity yet" />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-5 py-3">
                <Avatar name={r.user?.name ?? "Guest"} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {r.entity === "Reservation" && r.entityId ? (
                      <Link href={`/admin/reservations/${r.entityId}`} className="hover:text-primary hover:underline">{r.summary}</Link>
                    ) : (
                      r.summary
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.user?.name ?? "Guest (website)"} · {r.action}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} total={total} pageSize={SIZE} href={(p) => buildHref("/admin/activity", { ...sp, page: p })} />
      </Card>
    </>
  );
}
