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

/**
 * Splits a payment across folios with an open balance, largest balances first.
 * Anything left over (an overpayment) is added to the first folio as a credit.
 */
export function allocatePayment(balances: { id: string; balance: number }[], amount: number): { id: string; amount: number }[] {
  let remaining = round2(amount);
  const open = [...balances].filter((b) => b.balance > 0.004).sort((a, b) => b.balance - a.balance);
  const parts: { id: string; amount: number }[] = [];
  for (const b of open) {
    if (remaining <= 0) break;
    const share = round2(Math.min(b.balance, remaining));
    parts.push({ id: b.id, amount: share });
    remaining = round2(remaining - share);
  }
  if (remaining > 0) {
    const target = parts[0]?.id ?? balances[0]?.id;
    if (!target) return parts;
    const existing = parts.find((p) => p.id === target);
    if (existing) existing.amount = round2(existing.amount + remaining);
    else parts.push({ id: target, amount: remaining });
  }
  return parts;
}
