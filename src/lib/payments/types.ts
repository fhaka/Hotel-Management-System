export type CardDetails = {
  name: string;
  number: string;
  expiry: string; // MM/YY
  cvc: string;
};

export type ChargeResult =
  | { ok: true; reference: string; brand: string; last4: string }
  | { ok: false; error: string };

export type RefundResult = { ok: true; reference: string } | { ok: false; error: string };

/**
 * A card payment gateway. The demo provider simulates one; a Stripe provider can be added
 * by implementing this interface and selecting it with PAYMENT_PROVIDER=stripe.
 */
export interface PaymentProvider {
  readonly name: string;
  charge(args: { amount: number; card: CardDetails; description: string }): Promise<ChargeResult>;
  refund(args: { reference: string | null; amount: number }): Promise<RefundResult>;
}
