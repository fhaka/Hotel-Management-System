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
export async function canGuestView(r: { code: string; guestId: string }) {
  const user = await getCurrentUser();
  if (user && (can(user.role, "reservations") || user.guest?.id === r.guestId)) return true;
  const recent = ((await cookies()).get(RECENT_COOKIE)?.value ?? "").split(",");
  if (recent.includes(r.code)) return true;
  return (await unlockedCodes()).includes(r.code);
}
