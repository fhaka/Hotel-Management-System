import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "./session";
import { can, isStaff, type Permission } from "./permissions";

/** The signed-in user, verified against the database (inactive users are treated as signed out). */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, phone: true, active: true, guest: { select: { id: true } } },
  });
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export async function requireStaff(permission?: Permission) {
  const user = await requireUser("/admin");
  if (!isStaff(user.role)) redirect("/account");
  if (permission && !can(user.role, permission)) redirect("/admin/forbidden");
  return user;
}

/** For server actions: returns the user or throws, never redirects mid-mutation. */
export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, permission)) throw new Error("You do not have permission to perform this action.");
  return user;
}
