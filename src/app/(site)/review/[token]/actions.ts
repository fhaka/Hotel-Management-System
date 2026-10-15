"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { reviewableStay, verifyReviewToken } from "@/lib/reviews";

export type ReviewState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

const rating = z.coerce.number({ error: "Choose an overall rating." }).int().min(1, "Choose an overall rating.").max(5);
const optionalRating = z.union([z.literal("").transform(() => null), rating]).optional().transform((v) => v ?? null);

const schema = z.object({
  rating,
  ratingRooms: optionalRating,
  ratingService: optionalRating,
  ratingCleanliness: optionalRating,
  ratingValue: optionalRating,
  title: z.string().trim().min(3, "Give your review a short title.").max(100),
  body: z.string().trim().min(20, "Please write at least a couple of sentences.").max(3000),
  guestName: z.string().trim().min(2, "Enter the name to show with your review.").max(60),
  country: z.string().trim().max(60).optional(),
  consent: z.literal("on", { error: "Please confirm we may publish your review." }),
});

export async function submitReview(token: string, _: ReviewState, formData: FormData): Promise<ReviewState> {
  const reservationId = await verifyReviewToken(token);
  if (!reservationId) return { error: "This review link is invalid or has expired." };
  const stay = await reviewableStay(reservationId);
  if (stay.state === "done") return { error: "You have already reviewed this stay — thank you!" };
  if (stay.state !== "open") return { error: "This stay can't be reviewed yet." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return { error: flat.fieldErrors.consent?.[0] ?? flat.fieldErrors.rating?.[0] ?? "Please check the highlighted fields.", fieldErrors: flat.fieldErrors };
  }
  const { rating, ratingRooms, ratingService, ratingCleanliness, ratingValue, title, body, guestName, country } = parsed.data;
  const d = { rating, ratingRooms, ratingService, ratingCleanliness, ratingValue, title, body, guestName, country };
  try {
    await db.review.create({ data: { ...d, country: d.country || null, reservationId, status: "PENDING" } });
    await audit({ userId: null, action: "review.submit", entity: "Reservation", entityId: reservationId, summary: `Guest review received (${d.rating}★): "${d.title}"` });
  } catch (e) {
    // The unique reservationId guards against double submissions.
    if (JSON.stringify(e).includes("P2002") || String(e).includes("Unique constraint")) return { error: "You have already reviewed this stay — thank you!" };
    throw e;
  }
  return { success: "Thank you! Your review has been received and will appear on our website once our team has checked it." };
}
