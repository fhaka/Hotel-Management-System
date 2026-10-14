import "server-only";
import { DemoPaymentProvider } from "./demo";
import type { PaymentProvider } from "./types";

export type { CardDetails, PaymentProvider } from "./types";

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  const name = process.env.PAYMENT_PROVIDER ?? "demo";
  switch (name) {
    case "demo":
      provider = new DemoPaymentProvider();
      break;
    // case "stripe": provider = new StripePaymentProvider(process.env.STRIPE_SECRET_KEY!); break;
    default:
      throw new Error(`Unsupported PAYMENT_PROVIDER "${name}". Supported: demo.`);
  }
  return provider;
}

export function isDemoPayments() {
  return (process.env.PAYMENT_PROVIDER ?? "demo") === "demo";
}
