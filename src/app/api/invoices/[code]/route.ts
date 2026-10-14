import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canGuestView } from "@/lib/guest-access";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { reservationInclude } from "@/lib/reservations";
import { getSettings } from "@/lib/settings";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await db.reservation.findUnique({ where: { code }, include: reservationInclude });
  if (!r || !(await canGuestView(r))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderInvoicePdf(r, await getSettings());
  const filename = `${r.invoice?.number ?? `proforma-${r.code}`}.pdf`;
  const inline = new URL(request.url).searchParams.has("view");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
