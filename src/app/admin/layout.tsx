import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/dal";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { logout } from "@/app/(auth)/actions";
import { AdminShell } from "./shell";
import { NAV } from "./nav";

export const metadata: Metadata = { title: { default: "Operations", template: "%s · Imperial Operations" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(user.role, i.permission)) })).filter((g) => g.items.length);

  const d = today();
  const [arrivals, unread, tasks] = await Promise.all([
    can(user.role, "frontDesk") ? db.reservation.count({ where: { checkIn: d, status: "CONFIRMED" } }) : 0,
    can(user.role, "messages") ? db.contactMessage.count({ where: { handled: false } }) : 0,
    db.housekeepingTask.count({ where: { status: { not: "DONE" }, dueDate: { lte: d } } }),
  ]);

  return (
    <AdminShell
      nav={nav}
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
      badges={{ "/admin/front-desk": arrivals, "/admin/messages": unread, "/admin/housekeeping": tasks }}
      logoutAction={logout}
    >
      {children}
    </AdminShell>
  );
}
