import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, nightsBetween } from "@/lib/dates";
import { summarizeFolio } from "@/lib/folio";
import { formatMoney, pluralize, toNumber } from "@/lib/format";
import { vatPortion } from "@/lib/pricing";
import { billingParty, type FullGroup, type FullReservation } from "@/lib/reservations";
import type { HotelConfig } from "@/lib/settings";

// Built-in PDF fonts cover Latin-1; fold any other characters (e.g. ş, ı) to their base letter.
const pdfText = (s: string) => s.replace(/[^\u0000-\u00ff\u20ac\u2013\u2014\u2019\u201c\u201d\u2022]/g, (c) => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("\u0131", "i") || "?");

const NAVY = "#0f1a2e";
const GOLD = "#b8955a";
const MUTED = "#6b6f7b";
const LINE = "#e6e2d8";

const s = StyleSheet.create({
  page: { padding: 44, paddingBottom: 80, fontSize: 9, fontFamily: "Helvetica", color: "#141b2b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 20, borderBottom: `2 solid ${NAVY}` },
  brand: { fontFamily: "Times-Roman", fontSize: 22, letterSpacing: 3, color: NAVY },
  brandSub: { fontSize: 7, letterSpacing: 3, color: GOLD, marginTop: 3 },
  hotelInfo: { color: MUTED, marginTop: 8 },
  invoiceTitle: { fontFamily: "Times-Roman", fontSize: 18, color: NAVY, textAlign: "right" },
  meta: { marginTop: 6, alignItems: "flex-end", color: MUTED },
  strong: { fontFamily: "Helvetica-Bold", color: "#141b2b" },
  section: { flexDirection: "row", gap: 24, marginTop: 22 },
  box: { flex: 1 },
  label: { fontSize: 7, letterSpacing: 1.5, color: GOLD, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  table: { marginTop: 24 },
  thead: { flexDirection: "row", backgroundColor: "#f6f5f1", paddingVertical: 6, paddingHorizontal: 6, fontFamily: "Helvetica-Bold", fontSize: 8, color: MUTED },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottom: `0.5 solid ${LINE}` },
  roomHead: { paddingVertical: 6, paddingHorizontal: 6, marginTop: 6, fontFamily: "Helvetica-Bold", fontSize: 8.5, color: NAVY, borderBottom: `0.5 solid ${LINE}` },
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

const lines = (items: (string | null | undefined)[]) => items.filter(Boolean).map((l, i) => <Text key={i} style={{ marginBottom: 2 }}>{pdfText(l!)}</Text>);

type Room = FullReservation | FullGroup["reservations"][number];

/** Everything an invoice needs: one room, or every room of a group. */
export type InvoiceSource = {
  reference: string;
  referenceLabel: string;
  invoice: { number: string; issuedAt: Date; billTo: string; billToTaxId: string | null; billToAddress: string | null } | null;
  billTo: { name: string; taxId: string | null; address: string | null; email: string | null };
  rooms: Room[];
};

export function invoiceSourceForReservation(r: FullReservation): InvoiceSource {
  const party = billingParty(r.guest, r.company);
  return {
    reference: r.code,
    referenceLabel: "Reservation",
    invoice: r.invoice,
    billTo: { name: party.billTo, taxId: party.billToTaxId, address: party.billToAddress, email: r.company?.email ?? r.guest.email },
    rooms: [r],
  };
}

export function invoiceSourceForGroup(g: FullGroup): InvoiceSource {
  const party = billingParty(g.booker, g.company);
  return {
    reference: g.code,
    referenceLabel: "Group booking",
    invoice: g.invoice,
    billTo: { name: party.billTo, taxId: party.billToTaxId, address: party.billToAddress, email: g.company?.email ?? g.booker.email },
    // Cancelled rooms only appear when they carry a charge (e.g. a late-cancellation fee).
    rooms: g.reservations.filter((r) => r.charges.some((c) => !c.voided)),
  };
}

const ORDER = { ROOM: 0, CITY_TAX: 1, SERVICE: 2, FEE: 3, OTHER: 4, DISCOUNT: 5 } as const;

function roomLabel(r: Room) {
  return `${r.roomType.name}${r.room ? ` · Room ${r.room.number}` : ""}`;
}

function InvoiceDocument({ src, hotel }: { src: InvoiceSource; hotel: HotelConfig }) {
  const multi = src.rooms.length > 1;
  const allCharges = src.rooms.flatMap((r) => r.charges);
  const payments = src.rooms.flatMap((r) => r.payments).filter((p) => p.status === "SUCCEEDED").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const folio = summarizeFolio({ charges: allCharges, payments });
  const vatByRate = new Map<number, number>();
  for (const c of allCharges.filter((c) => !c.voided)) {
    const rate = toNumber(c.vatRate);
    if (rate > 0) vatByRate.set(rate, (vatByRate.get(rate) ?? 0) + vatPortion(toNumber(c.amount), rate));
  }
  const number = src.invoice?.number ?? `PROFORMA-${src.reference}`;
  const billTo = src.invoice
    ? { name: src.invoice.billTo, taxId: src.invoice.billToTaxId, address: src.invoice.billToAddress, email: src.billTo.email }
    : src.billTo;
  const first = src.rooms[0];
  // Group payments share a gateway reference; show each transaction once.
  const paymentRows = [...payments.reduce((map, p) => {
    const key = p.providerRef ? `${p.kind}:${p.providerRef}` : p.id;
    const prev = map.get(key);
    map.set(key, { ...p, total: (prev?.total ?? 0) + toNumber(p.amount) });
    return map;
  }, new Map<string, (typeof payments)[number] & { total: number }>()).values()];

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
            <Text style={s.invoiceTitle}>{src.invoice ? "Invoice" : "Pro-forma invoice"}</Text>
            <View style={s.meta}>
              <Text>
                No. <Text style={s.strong}>{number}</Text>
              </Text>
              {lines([`Date ${formatDate(src.invoice?.issuedAt ?? new Date())}`, `${src.referenceLabel} ${src.reference}`])}
            </View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.box}>
            <Text style={s.label}>BILL TO</Text>
            <Text style={s.strong}>{pdfText(billTo.name)}</Text>
            <View style={{ color: MUTED, marginTop: 3 }}>
              {lines([billTo.taxId ? `NIPT / VAT no. ${billTo.taxId}` : null, billTo.address, billTo.email])}
            </View>
          </View>
          <View style={s.box}>
            <Text style={s.label}>{multi ? `STAY · ${src.rooms.length} ROOMS` : "STAY"}</Text>
            {first && (
              <View>
                {multi
                  ? lines([
                      `${formatDate(first.checkIn)} – ${formatDate(first.checkOut)} (${pluralize(nightsBetween(first.checkIn, first.checkOut), "night")})`,
                      ...src.rooms.map((r) => `${roomLabel(r)} — ${pluralize(r.adults + r.children, "guest")}${r.occupantName ? ` (${r.occupantName})` : ""}`),
                    ])
                  : lines([
                      roomLabel(first),
                      `${formatDate(first.checkIn)} – ${formatDate(first.checkOut)} (${pluralize(nightsBetween(first.checkIn, first.checkOut), "night")})`,
                      `${pluralize(first.adults, "adult")}${first.children ? `, ${pluralize(first.children, "child", "children")}` : ""}`,
                    ])}
              </View>
            )}
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
          {src.rooms.map((r) => {
            const charges = r.charges.filter((c) => !c.voided).sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.date.getTime() - b.date.getTime());
            return (
              <View key={r.id}>
                {multi && <Text style={s.roomHead} wrap={false}>{pdfText(`${roomLabel(r)} · ${r.code}${r.occupantName ? ` · ${r.occupantName}` : ""}`)}</Text>}
                {charges.map((c) => (
                  <View key={c.id} style={s.row} wrap={false}>
                    <Text style={s.cDate}>{formatDate(c.date)}</Text>
                    <Text style={s.cDesc}>{pdfText(c.description)}</Text>
                    <Text style={s.cQty}>{c.quantity}</Text>
                    <Text style={s.cUnit}>{formatMoney(c.unitPrice)}</Text>
                    <Text style={s.cAmt}>{formatMoney(c.amount)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
          {paymentRows.length > 0 && multi && <Text style={s.roomHead}>Payments</Text>}
          {paymentRows.map((p) => (
            <View key={p.id} style={s.row} wrap={false}>
              <Text style={s.cDate}>{formatDate(p.createdAt)}</Text>
              <Text style={[s.cDesc, { color: MUTED }]}>
                {p.kind === "REFUND" ? "Refund" : "Payment"} — {p.method === "CARD" ? (p.cardLast4 ? `${p.cardBrand ?? "Card"} •••• ${p.cardLast4}` : "Card") : p.method === "CASH" ? "Cash" : "Bank transfer"}
              </Text>
              <Text style={s.cQty} />
              <Text style={s.cUnit} />
              <Text style={[s.cAmt, { color: MUTED }]}>{formatMoney(p.kind === "REFUND" ? p.total : -p.total)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
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

export async function renderInvoicePdf(src: InvoiceSource, hotel: HotelConfig): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument src={src} hotel={hotel} />);
}
