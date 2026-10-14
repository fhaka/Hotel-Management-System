"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CreditCard, Hotel, Info, Lock, ShieldCheck } from "lucide-react";
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea, useActionForm } from "@/components/ui/form";
import { formatLongDate, parseISODate } from "@/lib/dates";
import { formatMoney, pluralize } from "@/lib/format";
import { quoteStay } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import { bookAction } from "./actions";

type Props = {
  search: { checkIn: string; checkOut: string; adults: number; children: number };
  roomType: { id: string; slug: string; name: string; image: string; baseRate: number; weekendRate: number | null };
  seasons: { name: string; startDate: string; endDate: string; multiplier: number; roomTypeId: string | null }[];
  services: { id: string; name: string; description: string; price: number; unit: string; perNight: boolean; perGuest: boolean }[];
  settings: { cityTax: number; vatRate: number; checkInTime: string; freeCancellationHours: number };
  prefill: { firstName: string; lastName: string; email: string; phone: string; country: string } | null;
  signedIn: boolean;
  demoCards: { success: string; declined: string; insufficientFunds: string } | null;
};

export function CheckoutForm({ search, roomType, seasons, services, settings, prefill, signedIn, demoCards }: Props) {
  const { state, pending, formProps } = useActionForm(bookAction, null);
  const [extras, setExtras] = useState<string[]>([]);
  const [payment, setPayment] = useState<"card" | "hotel">("card");
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const e = state?.fieldErrors;

  const quote = useMemo(
    () =>
      quoteStay({
        roomType,
        seasons: seasons.map((s) => ({ ...s, startDate: new Date(s.startDate), endDate: new Date(s.endDate) })),
        checkIn: parseISODate(search.checkIn),
        checkOut: parseISODate(search.checkOut),
        adults: search.adults,
        children: search.children,
        extras: services.filter((s) => extras.includes(s.id)),
        cityTaxPerPersonNight: settings.cityTax,
        vatRate: settings.vatRate,
      }),
    [roomType, seasons, services, extras, search, settings],
  );

  const toggle = (id: string) => setExtras((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const formatCardNumber = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  return (
    <form {...formProps} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
      {Object.entries(search).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="roomType" value={roomType.slug} />
      {extras.map((id) => (
        <input key={id} type="hidden" name="extras" value={id} />
      ))}
      <input type="hidden" name="payment" value={payment} />

      <div className="space-y-6">
        <FormMessage state={state} />

        <Section title="Guest details" description={signedIn ? "We've pre-filled your details from your account." : undefined}>
          {!signedIn && (
            <p className="mb-5 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              Have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(`/book/checkout?${new URLSearchParams({ ...Object.fromEntries(Object.entries(search).map(([k, v]) => [k, String(v)])), roomType: roomType.slug })}`)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>{" "}
              to book faster and manage your stay online.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={e?.firstName}>
              <Input id="firstName" name="firstName" defaultValue={prefill?.firstName} autoComplete="given-name" required />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={e?.lastName}>
              <Input id="lastName" name="lastName" defaultValue={prefill?.lastName} autoComplete="family-name" required />
            </Field>
            <Field label="Email" htmlFor="email" error={e?.email} hint="Your confirmation will be sent here.">
              <Input id="email" name="email" type="email" defaultValue={prefill?.email} readOnly={signedIn && !!prefill?.email} autoComplete="email" required />
            </Field>
            <Field label="Phone" htmlFor="phone" error={e?.phone}>
              <Input id="phone" name="phone" type="tel" defaultValue={prefill?.phone} autoComplete="tel" required />
            </Field>
            <Field label="Country of residence" htmlFor="country" error={e?.country}>
              <Select id="country" name="country" defaultValue={prefill?.country || ""} required>
                <option value="" disabled>Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Estimated arrival time" htmlFor="estimatedArrival" error={e?.estimatedArrival}>
              <Select id="estimatedArrival" name="estimatedArrival" defaultValue="">
                <option value="">I don&apos;t know yet</option>
                {["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "After midnight"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Special requests (optional)" htmlFor="specialRequests" className="mt-4" error={e?.specialRequests}>
            <Textarea id="specialRequests" name="specialRequests" placeholder="E.g. high floor, extra pillows, celebrating an anniversary…" maxLength={500} />
          </Field>
        </Section>

        <Section title="Enhance your stay" description="Optional extras, added to your reservation.">
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => {
              const on = extras.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                    on ? "border-gold bg-gold-soft/50" : "border-border hover:border-gold/40",
                  )}
                >
                  <Checkbox checked={on} onChange={() => toggle(s.id)} className="mt-0.5" />
                  <span className="flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="whitespace-nowrap text-sm font-medium text-primary">{formatMoney(s.price)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{s.description}</span>
                    <span className="mt-1 block text-xs text-muted-foreground/80">per {s.unit}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </Section>

        <Section title="Payment">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["card", CreditCard, "Pay now", "Secure card payment. Fully refundable within the cancellation window."],
                ["hotel", Hotel, "Pay at the hotel", "No prepayment. Settle your bill at check-in or check-out."],
              ] as const
            ).map(([value, Icon, title, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPayment(value)}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-4 text-left transition-colors",
                  payment === value ? "border-primary bg-white ring-1 ring-primary" : "border-border bg-white hover:border-primary/40",
                )}
              >
                <Icon className={cn("mt-0.5 size-5", payment === value ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
                </span>
              </button>
            ))}
          </div>

          {payment === "card" && (
            <div className="mt-5 space-y-4">
              {demoCards && (
                <div className="flex gap-3 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-xs text-info">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Demo payment mode — no real charges are made.</p>
                    <p className="mt-1">
                      Use <button type="button" className="cursor-pointer font-mono underline" onClick={() => setCard({ number: demoCards.success, expiry: "12/30", cvc: "123", name: card.name || "Demo Guest" })}>{demoCards.success}</button> (success),{" "}
                      <span className="font-mono">{demoCards.declined}</span> (declined) or <span className="font-mono">{demoCards.insufficientFunds}</span> (insufficient funds), any future expiry and any CVC.
                    </p>
                  </div>
                </div>
              )}
              <Field label="Name on card" htmlFor="cardName" error={e?.cardName}>
                <Input id="cardName" name="cardName" value={card.name} onChange={(ev) => setCard({ ...card, name: ev.target.value })} autoComplete="cc-name" required />
              </Field>
              <Field label="Card number" htmlFor="cardNumber" error={e?.cardNumber}>
                <div className="relative">
                  <Input
                    id="cardNumber"
                    name="cardNumber"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={(ev) => setCard({ ...card, number: formatCardNumber(ev.target.value) })}
                    className="pl-10 font-mono"
                    required
                  />
                  <CreditCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry (MM/YY)" htmlFor="cardExpiry" error={e?.cardExpiry}>
                  <Input id="cardExpiry" name="cardExpiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={(ev) => setCard({ ...card, expiry: formatExpiry(ev.target.value) })} required />
                </Field>
                <Field label="Security code" htmlFor="cardCvc" error={e?.cardCvc}>
                  <Input id="cardCvc" name="cardCvc" inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" maxLength={4} value={card.cvc} onChange={(ev) => setCard({ ...card, cvc: ev.target.value.replace(/\D/g, "") })} required />
                </Field>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Card details are processed securely and never stored by the hotel.
              </p>
            </div>
          )}
        </Section>

        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <Checkbox name="terms" required className="mt-0.5" />
          <span>
            I accept the booking conditions: free cancellation up to {settings.freeCancellationHours} hours before arrival; later cancellations and
            no-shows are charged the first night.
          </span>
        </label>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-lg shadow-primary/5">
          <div className="relative aspect-[16/9]">
            <Image src={roomType.image} alt={roomType.name} fill sizes="380px" className="object-cover" />
          </div>
          <div className="p-6">
            <p className="font-serif text-2xl text-primary">{roomType.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Check-in</p>
                <p className="font-medium">{formatLongDate(search.checkIn)}</p>
                <p className="text-xs text-muted-foreground">from {settings.checkInTime}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Check-out</p>
                <p className="font-medium">{formatLongDate(search.checkOut)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {pluralize(quote.nightCount, "night")} · {pluralize(search.adults, "adult")}
              {search.children ? `, ${pluralize(search.children, "child", "children")}` : ""}
            </p>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Room ({pluralize(quote.nightCount, "night")})</dt>
                <dd>{formatMoney(quote.roomTotal)}</dd>
              </div>
              {quote.extras.map((x) => (
                <div key={x.serviceId} className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {x.name}
                    {x.quantity > 1 ? ` × ${x.quantity}` : ""}
                  </dt>
                  <dd>{formatMoney(x.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">City tax</dt>
                <dd>{formatMoney(quote.cityTax)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="text-primary">{formatMoney(quote.total)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">Includes {formatMoney(quote.vatIncluded)} VAT</p>
            </dl>
            <SubmitButton pending={pending} size="lg" className="mt-6 w-full" pendingText={payment === "card" ? "Processing payment…" : "Confirming…"}>
              {payment === "card" ? `Pay ${formatMoney(quote.total)} & confirm` : "Confirm reservation"}
            </SubmitButton>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" /> Best rate guaranteed · Instant confirmation
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6">
      <h2 className="font-serif text-2xl text-primary">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
