import { describe, expect, it } from "vitest";
import { allocatePayment, summarizeFolio } from "@/lib/folio";

describe("summarizeFolio", () => {
  const charges = [
    { amount: 120, vatRate: 20, voided: false, type: "ROOM" },
    { amount: 2, vatRate: 0, voided: false, type: "CITY_TAX" },
    { amount: 999, vatRate: 20, voided: true, type: "SERVICE" },
  ];
  it("ignores voided charges and splits VAT", () => {
    const f = summarizeFolio({ charges, payments: [] });
    expect(f).toMatchObject({ total: 122, vat: 20, net: 102, balance: 122 });
  });
  it("nets payments and refunds, ignoring failed payments", () => {
    const f = summarizeFolio({
      charges,
      payments: [
        { amount: 200, kind: "CHARGE", status: "SUCCEEDED" },
        { amount: 78, kind: "REFUND", status: "SUCCEEDED" },
        { amount: 500, kind: "CHARGE", status: "FAILED" },
      ],
    });
    expect(f).toMatchObject({ paid: 200, refunded: 78, balance: 0 });
  });
  it("reports a credit as a negative balance", () => {
    expect(summarizeFolio({ charges, payments: [{ amount: 150, kind: "CHARGE", status: "SUCCEEDED" }] }).balance).toBe(-28);
  });
});

describe("allocatePayment", () => {
  const balances = [
    { id: "a", balance: 100 },
    { id: "b", balance: 250 },
    { id: "c", balance: 0 },
  ];
  it("settles the largest balances first", () => {
    expect(allocatePayment(balances, 300)).toEqual([
      { id: "b", amount: 250 },
      { id: "a", amount: 50 },
    ]);
  });
  it("puts an overpayment on the first folio as credit", () => {
    expect(allocatePayment(balances, 400)).toEqual([
      { id: "b", amount: 300 },
      { id: "a", amount: 100 },
    ]);
  });
  it("handles groups that are already settled", () => {
    expect(allocatePayment([{ id: "a", balance: 0 }], 20)).toEqual([{ id: "a", amount: 20 }]);
  });
});
