import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canGuestView, canGuestViewGroup, isGroupCode } from "@/lib/guest-access";
import { invoiceSourceForGroup, invoiceSourceForReservation, renderInvoicePdf, type InvoiceSource } from "@/lib/pdf/invoice";
import { getGroup, reservationInclude } from "@/lib/reservations";
import { getSettings } from "@/lib/settings";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/** PDF invoice for a reservation or group code. Rooms of a single-bill group get the group invoice. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  let source: InvoiceSource;
  if (isGroupCode(code)) {
    const g = await getGroup({ code });
    if (!g || !(await canGuestViewGroup(g))) return notFound();
    source = invoiceSourceForGroup(g);
  } else {
    const r = await db.reservation.findUnique({ where: { code }, include: reservationInclude });
    if (!r || !(await canGuestView(r))) return notFound();
    const g = r.group?.singleBill ? await getGroup({ id: r.group.id }) : null;
    source = g ? invoiceSourceForGroup(g) : invoiceSourceForReservation(r);
  }

  const pdf = await renderInvoicePdf(source, await getSettings());
  const filename = `${source.invoice?.number ?? `proforma-${source.reference}`}.pdf`;
  const inline = new URL(request.url).searchParams.has("view");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
