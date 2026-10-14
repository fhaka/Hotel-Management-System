import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, nightsBetween } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney, pluralize, toNumber } from "@/lib/format";
import { vatPortion } from "@/lib/pricing";
import type { FullReservation } from "@/lib/reservations";
import type { HotelConfig } from "@/lib/settings";

// Built-in PDF fonts cover Latin-1; fold any other characters (e.g. ş, ı) to their base letter.
const pdfText = (s: string) => s.replace(/[^\u0000-ÿ€–—’“”•]/g, (c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").replace("ı", "i") || "?");

const NAVY = "#0f1a2e";
const GOLD = "#b8955a";
const MUTED = "#6b6f7b";
const LINE = "#e6e2d8";

const s = StyleSheet.create({
  page: { padding: 44, fontSize: 9, fontFamily: "Helvetica", color: "#141b2b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 20, borderBottom: `2 solid ${NAVY}` },
  brand: { fontFamily: "Times-Roman", fontSize: 22, letterSpacing: 3, color: NAVY },
  brandSub: { fontSize: 7, letterSpacing: 3, color: GOLD, marginTop: 3 },
  hotelInfo: { color: MUTED, marginTop: 8, lineHeight: 1.5 },
  invoiceTitle: { fontFamily: "Times-Roman", fontSize: 18, color: NAVY, textAlign: "right" },
  meta: { marginTop: 6, alignItems: "flex-end", color: MUTED, lineHeight: 1.6 },
  strong: { fontFamily: "Helvetica-Bold", color: "#141b2b" },
  section: { flexDirection: "row", gap: 24, marginTop: 22 },
  box: { flex: 1 },
  label: { fontSize: 7, letterSpacing: 1.5, color: GOLD, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  table: { marginTop: 24 },
  thead: { flexDirection: "row", backgroundColor: "#f6f5f1", paddingVertical: 6, paddingHorizontal: 6, fontFamily: "Helvetica-Bold", fontSize: 8, color: MUTED },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottom: `0.5 solid ${LINE}` },
  cDate: { width: "14%" },
  cDesc: { width: "46%" },
  cQty: { width: "8%", textAlign: "right" },
  cUnit: { width: "16%", textAlign: "right" },
  cAmt: { width: "16%", textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, marginTop: 4, borderTop: `1 solid ${NAVY}`, fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY },
  footer: { position: "absolute", bottom: 32, left: 44, right: 44, textAlign: "center", color: MUTED, fontSize: 7.5, borderTop: `0.5 solid ${LINE}`, paddingTop: 10, lineHeight: 1.5 },
  paid: { marginTop: 18, alignSelf: "flex-start", border: `1 solid ${GOLD}`, color: GOLD, paddingVertical: 4, paddingHorizontal: 10, fontFamily: "Helvetica-Bold", letterSpacing: 2, fontSize: 9 },
});

const lines = (items: string[]) => items.filter(Boolean).map((l, i) => <Text key={i}>{pdfText(l)}</Text>);

function InvoiceDocument({ r, hotel }: { r: FullReservation; hotel: HotelConfig }) {
  const order = { ROOM: 0, CITY_TAX: 1, SERVICE: 2, FEE: 3, OTHER: 4, DISCOUNT: 5 } as const;
  const charges = r.charges.filter((c) => !c.voided).sort((a, b) => order[a.type] - order[b.type] || a.date.getTime() - b.date.getTime());
  const payments = r.payments.filter((p) => p.status === "SUCCEEDED");
  const folio = summarizeFolio(r);
  const vatByRate = new Map<number, number>();
  for (const c of charges) {
    const rate = toNumber(c.vatRate);
    if (rate > 0) vatByRate.set(rate, (vatByRate.get(rate) ?? 0) + vatPortion(toNumber(c.amount), rate));
  }
  const number = r.invoice?.number ?? `PROFORMA-${r.code}`;

  return (
    <Document title={`Invoice ${number}`} author={hotel.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>HOTEL IMPERIAL</Text>
            <Text style={s.brandSub}>TIRANA · ALBANIA</Text>
            <View style={s.hotelInfo}>
              {lines([hotel.legalName, `${hotel.address}, ${hotel.city}, ${hotel.country}`, `NIPT ${hotel.taxId} · ${hotel.phone}`, hotel.email])}
            </View>
          </View>
          <View>
            <Text style={s.invoiceTitle}>{r.invoice ? "Invoice" : "Pro-forma invoice"}</Text>
            <View style={s.meta}>
              <Text>
                No. <Text style={s.strong}>{number}</Text>
              </Text>
              {lines([`Date ${formatDate(r.invoice?.issuedAt ?? new Date())}`, `Reservation ${r.code}`])}
            </View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.box}>
            <Text style={s.label}>BILL TO</Text>
            <Text style={s.strong}>{pdfText(`${r.guest.firstName} ${r.guest.lastName}`)}</Text>
            <View style={{ color: MUTED, marginTop: 3, lineHeight: 1.5 }}>
              {lines([[r.guest.address, r.guest.city, r.guest.country].filter(Boolean).join(", "), r.guest.email ?? ""])}
            </View>
          </View>
          <View style={s.box}>
            <Text style={s.label}>STAY</Text>
            <View style={{ lineHeight: 1.6 }}>
              {lines([
                `${r.roomType.name}${r.room ? ` · Room ${r.room.number}` : ""}`,
                `${formatDate(r.checkIn)} – ${formatDate(r.checkOut)} (${pluralize(nightsBetween(r.checkIn, r.checkOut), "night")})`,
                `${pluralize(r.adults, "adult")}${r.children ? `, ${pluralize(r.children, "child", "children")}` : ""}`,
              ])}
            </View>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.thead}>
            <Text style={s.cDate}>DATE</Text>
            <Text style={s.cDesc}>DESCRIPTION</Text>
            <Text style={s.cQty}>QTY</Text>
            <Text style={s.cUnit}>UNIT</Text>
            <Text style={s.cAmt}>AMOUNT</Text>
          </View>
          {charges.map((c) => (
            <View key={c.id} style={s.row} wrap={false}>
              <Text style={s.cDate}>{formatDate(c.date)}</Text>
              <Text style={s.cDesc}>{pdfText(c.description)}</Text>
              <Text style={s.cQty}>{c.quantity}</Text>
              <Text style={s.cUnit}>{formatMoney(c.unitPrice)}</Text>
              <Text style={s.cAmt}>{formatMoney(c.amount)}</Text>
            </View>
          ))}
          {payments.map((p) => (
            <View key={p.id} style={s.row} wrap={false}>
              <Text style={s.cDate}>{formatDate(p.createdAt)}</Text>
              <Text style={[s.cDesc, { color: MUTED }]}>
                {p.kind === "REFUND" ? "Refund" : "Payment"} — {p.method === "CARD" ? (p.cardLast4 ? `${p.cardBrand ?? "Card"} •••• ${p.cardLast4}` : "Card") : p.method === "CASH" ? "Cash" : "Bank transfer"}
              </Text>
              <Text style={s.cQty} />
              <Text style={s.cUnit} />
              <Text style={[s.cAmt, { color: MUTED }]}>{formatMoney(p.kind === "REFUND" ? toNumber(p.amount) : -toNumber(p.amount))}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>Net amount</Text>
            <Text>{formatMoney(folio.net)}</Text>
          </View>
          {[...vatByRate].map(([rate, amount]) => (
            <View key={rate} style={s.totalRow}>
              <Text style={{ color: MUTED }}>VAT {rate}% (included)</Text>
              <Text>{formatMoney(amount)}</Text>
            </View>
          ))}
          <View style={s.grand}>
            <Text>Total</Text>
            <Text>{formatMoney(folio.total)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>Paid</Text>
            <Text>{formatMoney(folio.paid - folio.refunded)}</Text>
          </View>
          <View style={[s.totalRow, { fontFamily: "Helvetica-Bold" }]}>
            <Text>Balance due</Text>
            <Text>{formatMoney(Math.max(folio.balance, 0))}</Text>
          </View>
        </View>
        {folio.balance <= 0.004 && folio.total > 0 && <Text style={s.paid}>PAID IN FULL</Text>}

        <Text style={s.footer} fixed>
          Thank you for staying at Hotel Imperial. City tax is exempt from VAT. Prices include VAT at the applicable rate.
          {"\n"}
          {pdfText(hotel.legalName)} · NIPT {hotel.taxId} · {pdfText(hotel.address)}, {pdfText(hotel.city)}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(r: FullReservation, hotel: HotelConfig): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument r={r} hotel={hotel} />);
}
