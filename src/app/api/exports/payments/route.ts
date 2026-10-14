import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "billing")) return new Response("Forbidden", { status: 403 });
  const rows = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 20_000,
    include: { reservation: { include: { guest: true } }, processedBy: { select: { name: true } } },
  });
  const csv = toCsv(
    ["Date", "Reservation", "Guest", "Type", "Method", "Card", "Amount", "Provider", "Reference", "Taken by", "Note"],
    rows.map((p) => [p.createdAt, p.reservation.code, `${p.reservation.guest.firstName} ${p.reservation.guest.lastName}`, p.kind, p.method, p.cardLast4 ? `${p.cardBrand} ${p.cardLast4}` : "", (p.kind === "REFUND" ? -p.amount.toNumber() : p.amount.toNumber()).toFixed(2), p.provider, p.providerRef, p.processedBy?.name ?? "Online", p.note]),
  );
  return csvResponse(`payments-${todayISO()}.csv`, csv);
}
