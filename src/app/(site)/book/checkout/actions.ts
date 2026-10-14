"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { isISODate, parseISODate } from "@/lib/dates";
import { sendReservationEmail } from "@/lib/notifications";
import { BookingError, bookOnline } from "@/lib/reservations";

export type BookState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

const schema = z
  .object({
    roomType: z.string().min(1),
    checkIn: z.string().refine(isISODate),
    checkOut: z.string().refine(isISODate),
    adults: z.coerce.number().int().min(1).max(6),
    children: z.coerce.number().int().min(0).max(4),
    firstName: z.string().trim().min(1, "Enter your first name.").max(60),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    phone: z.string().trim().min(6, "Enter a phone number we can reach you on.").max(30),
    country: z.string().trim().min(1, "Select your country."),
    estimatedArrival: z.string().max(20).optional(),
    specialRequests: z.string().trim().max(500).optional(),
    extras: z.array(z.string()).default([]),
    payment: z.enum(["card", "hotel"]),
    cardName: z.string().optional(),
    cardNumber: z.string().optional(),
    cardExpiry: z.string().optional(),
    cardCvc: z.string().optional(),
    terms: z.literal("on", { error: "Please accept the booking conditions." }),
  })
  .superRefine((d, ctx) => {
    if (d.payment !== "card") return;
    if (!d.cardName?.trim()) ctx.addIssue({ code: "custom", path: ["cardName"], message: "Enter the name on the card." });
    if (!d.cardNumber?.trim()) ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Enter the card number." });
    if (!d.cardExpiry?.trim()) ctx.addIssue({ code: "custom", path: ["cardExpiry"], message: "Enter the expiry date." });
    if (!d.cardCvc?.trim()) ctx.addIssue({ code: "custom", path: ["cardCvc"], message: "Enter the security code." });
  });

export async function bookAction(_: BookState, formData: FormData): Promise<BookState> {
  const raw = { ...Object.fromEntries(formData), extras: formData.getAll("extras") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return { error: flat.fieldErrors.terms?.[0] ?? "Please check the highlighted fields.", fieldErrors: flat.fieldErrors };
  }
  const d = parsed.data;
  const user = await getCurrentUser();
  const roomType = await db.roomType.findUnique({ where: { slug: d.roomType } });
  if (!roomType) return { error: "This room type is no longer available." };

  let reservation;
  try {
    reservation = await bookOnline({
      roomTypeId: roomType.id,
      checkIn: parseISODate(d.checkIn),
      checkOut: parseISODate(d.checkOut),
      adults: d.adults,
      children: d.children,
      extraServiceIds: d.extras,
      specialRequests: d.specialRequests,
      estimatedArrival: d.estimatedArrival,
      guest:
        user?.guest && user.role === "GUEST"
          ? { id: user.guest.id }
          : { firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, country: d.country, userId: user?.role === "GUEST" ? user.id : null },
      card: d.payment === "card" ? { name: d.cardName!, number: d.cardNumber!, expiry: d.cardExpiry!, cvc: d.cardCvc! } : undefined,
    });
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    console.error(e);
    return { error: "Something went wrong while booking. Your card has not been charged — please try again." };
  }

  // Remember recent bookings in this browser so the confirmation page can be shown without signing in.
  const jar = await cookies();
  const recent = (jar.get("hi_recent")?.value ?? "").split(",").filter(Boolean).slice(-4);
  jar.set("hi_recent", [...recent, reservation.code].join(","), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });

  const id = reservation.id;
  after(() => sendReservationEmail(id, "confirmation"));
  redirect(`/book/confirmation/${reservation.code}`);
}
