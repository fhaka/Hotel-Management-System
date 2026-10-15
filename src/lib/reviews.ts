import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { round2 } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

const REVIEW_LINK_DAYS = 90;
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

/** A signed, expiring link token that lets a departed guest review one stay without signing in. */
export async function signReviewToken(reservationId: string) {
  return new SignJWT({ rid: reservationId, purpose: "review" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${REVIEW_LINK_DAYS}d`)
    .sign(key());
}

export async function verifyReviewToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify<{ rid: string; purpose: string }>(token, key(), { algorithms: ["HS256"] });
    return payload.purpose === "review" ? payload.rid : null;
  } catch {
    return null;
  }
}

export async function reviewUrl(reservationId: string) {
  return `${process.env.APP_URL ?? "http://localhost:3000"}/review/${await signReviewToken(reservationId)}`;
}

/** "Giulia Rossi" → "Giulia R." — how names appear on the public site. */
export function publicName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim().charAt(0).toUpperCase()}.`.trim();
}

/** The reservation a review invitation refers to, and whether it can still be reviewed. */
export async function reviewableStay(reservationId: string) {
  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: true, roomType: true, review: true, group: { select: { name: true } } },
  });
  if (!r) return { state: "missing" as const };
  if (r.review) return { state: "done" as const, r };
  if (r.status !== "CHECKED_OUT") return { state: "not-yet" as const, r };
  return { state: "open" as const, r };
}

export type ReviewStats = {
  count: number;
  average: number;
  distribution: { stars: number; count: number }[];
  categories: { key: "ratingRooms" | "ratingService" | "ratingCleanliness" | "ratingValue"; label: string; average: number | null }[];
};

export const CATEGORY_LABELS = {
  ratingRooms: "Rooms",
  ratingService: "Service",
  ratingCleanliness: "Cleanliness",
  ratingValue: "Value for money",
} as const;

export async function reviewStats(where: Prisma.ReviewWhereInput = { status: "PUBLISHED" }): Promise<ReviewStats> {
  const [agg, groups] = await Promise.all([
    db.review.aggregate({
      where,
      _count: true,
      _avg: { rating: true, ratingRooms: true, ratingService: true, ratingCleanliness: true, ratingValue: true },
    }),
    db.review.groupBy({ by: ["rating"], where, _count: true }),
  ]);
  return {
    count: agg._count,
    average: round2(agg._avg.rating ?? 0),
    distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: groups.find((g) => g.rating === stars)?._count ?? 0 })),
    categories: (Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((k) => ({
      key: k,
      label: CATEGORY_LABELS[k],
      average: agg._avg[k] == null ? null : round2(agg._avg[k]!),
    })),
  };
}
