"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { isISODate, parseISODate } from "@/lib/dates";
import { sendGroupEmail, sendReservationEmail } from "@/lib/notifications";
import { BookingError, MAX_ROOMS_PER_BOOKING, bookOnline } from "@/lib/reservations";

export type BookState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

const roomsSchema = z
  .array(
    z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      adults: z.number().int().min(1).max(10),
      children: z.number().int().min(0).max(10),
      occupantName: z.string().trim().max(80).optional(),
    }),
  )
  .min(1)
  .max(MAX_ROOMS_PER_BOOKING);

const schema = z
  .object({
    checkIn: z.string().refine(isISODate),
    checkOut: z.string().refine(isISODate),
    rooms: z.string().transform((v, ctx) => {
      try {
        return roomsSchema.parse(JSON.parse(v));
      } catch {
        ctx.addIssue({ code: "custom", message: "Your room selection is invalid. Please choose your rooms again." });
        return z.NEVER;
      }
    }),
    firstName: z.string().trim().min(1, "Enter your first name.").max(60),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    phone: z.string().trim().min(6, "Enter a phone number we can reach you on.").max(30),
    country: z.string().trim().min(1, "Select your country."),
    estimatedArrival: z.string().max(20).optional(),
    specialRequests: z.string().trim().max(500).optional(),
    extras: z.array(z.string()).default([]),
    company: z.literal("on").optional(),
    companyName: z.string().trim().max(120).optional(),
    companyTaxId: z.string().trim().max(30).optional(),
    companyAddress: z.string().trim().max(160).optional(),
    companyCity: z.string().trim().max(80).optional(),
    companyCountry: z.string().trim().max(60).optional(),
    payment: z.enum(["card", "hotel"]),
    cardName: z.string().optional(),
    cardNumber: z.string().optional(),
    cardExpiry: z.string().optional(),
    cardCvc: z.string().optional(),
    terms: z.literal("on", { error: "Please accept the booking conditions." }),
  })
  .superRefine((d, ctx) => {
    if (d.company) {
      if (!d.companyName) ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter the company name." });
      if (!d.companyTaxId || !/^[A-Z0-9-]{5,20}$/i.test(d.companyTaxId)) ctx.addIssue({ code: "custom", path: ["companyTaxId"], message: "Enter a valid tax number (e.g. L12345678A)." });
      if (!d.companyAddress) ctx.addIssue({ code: "custom", path: ["companyAddress"], message: "Enter the company address." });
    }
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
    return { error: flat.fieldErrors.terms?.[0] ?? flat.fieldErrors.rooms?.[0] ?? "Please check the highlighted fields.", fieldErrors: flat.fieldErrors };
  }
  const d = parsed.data;
  const user = await getCurrentUser();
  const types = await db.roomType.findMany({ where: { slug: { in: d.rooms.map((r) => r.slug) } }, select: { id: true, slug: true } });
  const rooms = d.rooms.map((r) => ({ ...r, roomTypeId: types.find((t) => t.slug === r.slug)?.id }));
  if (rooms.some((r) => !r.roomTypeId)) return { error: "One of the selected room types is no longer available." };

  let booking;
  try {
    booking = await bookOnline({
      checkIn: parseISODate(d.checkIn),
      checkOut: parseISODate(d.checkOut),
      rooms: rooms.map((r) => ({ roomTypeId: r.roomTypeId!, adults: r.adults, children: r.children, occupantName: r.occupantName })),
      extraServiceIds: d.extras,
      specialRequests: d.specialRequests,
      estimatedArrival: d.estimatedArrival,
      company: d.company
        ? { name: d.companyName!, taxId: d.companyTaxId, address: d.companyAddress, city: d.companyCity, country: d.companyCountry, email: d.email }
        : null,
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

  const code = booking.group?.code ?? booking.reservations[0]!.code;
  // Remember recent bookings in this browser so the confirmation page can be shown without signing in.
  const jar = await cookies();
  const recent = (jar.get("hi_recent")?.value ?? "").split(",").filter(Boolean).slice(-4);
  jar.set("hi_recent", [...recent, code].join(","), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });

  const groupId = booking.group?.id;
  const reservationId = booking.reservations[0]!.id;
  after(() => (groupId ? sendGroupEmail(groupId, "confirmation") : sendReservationEmail(reservationId, "confirmation")));
  redirect(`/book/confirmation/${code}`);
}
