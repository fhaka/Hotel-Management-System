import { randomCode } from "@/lib/utils";
import type { CardDetails, ChargeResult, PaymentProvider, RefundResult } from "./types";

/** Published test cards, mirroring the behaviour of common gateways' test modes. */
export const DEMO_CARDS = {
  success: "4242 4242 4242 4242",
  declined: "4000 0000 0000 0002",
  insufficientFunds: "4000 0000 0000 9995",
} as const;

function luhn(number: string) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function cardBrand(number: string) {
  if (/^4/.test(number)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(number)) return "Mastercard";
  if (/^3[47]/.test(number)) return "Amex";
  return "Card";
}

export function validateCard(card: CardDetails): string | null {
  const number = card.number.replace(/\D/g, "");
  if (card.name.trim().length < 2) return "Enter the name shown on the card.";
  if (number.length < 13 || number.length > 19 || !luhn(number)) return "The card number is invalid.";
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry.trim());
  if (!match) return "Enter the expiry date as MM/YY.";
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return "The expiry month is invalid.";
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return "The card has expired.";
  if (!/^\d{3,4}$/.test(card.cvc.trim())) return "The security code is invalid.";
  return null;
}

export class DemoPaymentProvider implements PaymentProvider {
  readonly name = "demo";

  async charge({ amount, card }: { amount: number; card: CardDetails; description: string }): Promise<ChargeResult> {
    const invalid = validateCard(card);
    if (invalid) return { ok: false, error: invalid };
    if (amount <= 0) return { ok: false, error: "Nothing to charge." };
    const number = card.number.replace(/\D/g, "");
    // Simulate network latency so the UI's processing state is visible.
    await new Promise((r) => setTimeout(r, 700));
    if (number === DEMO_CARDS.declined.replace(/\s/g, "")) return { ok: false, error: "Your card was declined." };
    if (number === DEMO_CARDS.insufficientFunds.replace(/\s/g, "")) return { ok: false, error: "Your card has insufficient funds." };
    return { ok: true, reference: `demo_ch_${randomCode(14)}`, brand: cardBrand(number), last4: number.slice(-4) };
  }

  async refund(): Promise<RefundResult> {
    await new Promise((r) => setTimeout(r, 300));
    return { ok: true, reference: `demo_re_${randomCode(14)}` };
  }
}
