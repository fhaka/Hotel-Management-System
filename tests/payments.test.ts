import { describe, expect, it } from "vitest";
import { DEMO_CARDS, DemoPaymentProvider, cardBrand, validateCard } from "@/lib/payments/demo";

const card = (number: string) => ({ name: "Test Guest", number, expiry: "12/40", cvc: "123" });

describe("demo payment gateway", () => {
  const gateway = new DemoPaymentProvider();
  it("approves the success test card", async () => {
    const r = await gateway.charge({ amount: 100, card: card(DEMO_CARDS.success), description: "test" });
    expect(r).toMatchObject({ ok: true, brand: "Visa", last4: "4242" });
  });
  it("declines the decline and insufficient-funds test cards", async () => {
    expect(await gateway.charge({ amount: 100, card: card(DEMO_CARDS.declined), description: "t" })).toMatchObject({ ok: false });
    expect(await gateway.charge({ amount: 100, card: card(DEMO_CARDS.insufficientFunds), description: "t" })).toMatchObject({ ok: false, error: expect.stringMatching(/insufficient/) });
  });
  it("validates card details", () => {
    expect(validateCard(card("4242 4242 4242 4241"))).toMatch(/invalid/); // fails Luhn
    expect(validateCard({ ...card(DEMO_CARDS.success), expiry: "01/20" })).toMatch(/expired/);
    expect(validateCard({ ...card(DEMO_CARDS.success), cvc: "1" })).toMatch(/security code/);
    expect(validateCard(card(DEMO_CARDS.success))).toBeNull();
  });
  it("detects card brands", () => {
    expect(cardBrand("5555555555554444")).toBe("Mastercard");
    expect(cardBrand("378282246310005")).toBe("Amex");
  });
});
