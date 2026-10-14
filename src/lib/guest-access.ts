import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

const MANAGE_COOKIE = "hi_manage";
const RECENT_COOKIE = "hi_recent";

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

/** Codes this browser has unlocked via "manage booking" (code + email), stored in a signed cookie. */
async function unlockedCodes(): Promise<string[]> {
  const token = (await cookies()).get(MANAGE_COOKIE)?.value;
  if (!token) return [];
  try {
    const { payload } = await jwtVerify<{ codes: string[] }>(token, key());
    return payload.codes ?? [];
  } catch {
    return [];
  }
}

export async function unlockReservation(code: string) {
  const codes = [...new Set([...(await unlockedCodes()), code])].slice(-10);
  const token = await new SignJWT({ codes }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("2h").sign(key());
  (await cookies()).set(MANAGE_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 2 * 60 * 60 });
}

/** Whether the current visitor may view a reservation on the guest-facing site. */
export async function canGuestView(r: { code: string; guestId: string; group?: { code: string } | null }) {
  const user = await getCurrentUser();
  if (user && (can(user.role, "reservations") || user.guest?.id === r.guestId)) return true;
  // Unlocking a group booking also unlocks each of its rooms.
  const codes = [r.code, ...(r.group ? [r.group.code] : [])];
  const recent = ((await cookies()).get(RECENT_COOKIE)?.value ?? "").split(",");
  if (codes.some((c) => recent.includes(c))) return true;
  const unlocked = await unlockedCodes();
  return codes.some((c) => unlocked.includes(c));
}

/** Whether the current visitor may view a group booking (booker, staff, or unlocked in this browser). */
export async function canGuestViewGroup(g: { code: string; bookerId: string }) {
  return canGuestView({ code: g.code, guestId: g.bookerId });
}

export const isGroupCode = (code: string) => /^HG[A-Z0-9]{6}$/i.test(code);
