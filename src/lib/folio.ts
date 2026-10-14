import { round2, toNumber } from "@/lib/format";
import { vatPortion } from "@/lib/pricing";

type DecimalLike = Parameters<typeof toNumber>[0];

export type FolioInput = {
  charges: { amount: DecimalLike; vatRate: DecimalLike; voided: boolean; type: string }[];
  payments: { amount: DecimalLike; kind: "CHARGE" | "REFUND"; status: "SUCCEEDED" | "FAILED" }[];
};

export type FolioSummary = {
  total: number;
  vat: number;
  net: number;
  paid: number;
  refunded: number;
  balance: number;
};

export function summarizeFolio({ charges, payments }: FolioInput): FolioSummary {
  const live = charges.filter((c) => !c.voided);
  const total = round2(live.reduce((s, c) => s + toNumber(c.amount), 0));
  const vat = round2(live.reduce((s, c) => s + vatPortion(toNumber(c.amount), toNumber(c.vatRate)), 0));
  const ok = payments.filter((p) => p.status === "SUCCEEDED");
  const paid = round2(ok.filter((p) => p.kind === "CHARGE").reduce((s, p) => s + toNumber(p.amount), 0));
  const refunded = round2(ok.filter((p) => p.kind === "REFUND").reduce((s, p) => s + toNumber(p.amount), 0));
  return { total, vat, net: round2(total - vat), paid, refunded, balance: round2(total - paid + refunded) };
}
