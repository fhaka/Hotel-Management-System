"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, ChevronLeft, CreditCard, Hotel, Info, Lock, ShieldCheck } from "lucide-react";
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea, useActionForm } from "@/components/ui/form";
import { COUNTRIES } from "@/lib/countries";
import { formatLongDate, parseISODate } from "@/lib/dates";
import { formatMoney, pluralize, round2 } from "@/lib/format";
import { quoteStay } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { bookAction } from "./actions";

type RoomLine = {
  roomTypeId: string;
  slug: string;
  name: string;
  image: string;
  baseRate: number;
  weekendRate: number | null;
  maxAdults: number;
  maxChildren: number;
  adults: number;
  children: number;
};

type Props = {
  search: { checkIn: string; checkOut: string };
  backHref: string;
  rooms: RoomLine[];
  seasons: { name: string; startDate: string; endDate: string; multiplier: number; roomTypeId: string | null }[];
  services: { id: string; name: string; description: string; price: number; unit: string; perNight: boolean; perGuest: boolean }[];
  settings: { cityTax: number; vatRate: number; checkInTime: string; freeCancellationHours: number };
  prefill: { firstName: string; lastName: string; email: string; phone: string; country: string } | null;
  signedIn: boolean;
  demoCards: { success: string; declined: string; insufficientFunds: string } | null;
};

export function CheckoutForm({ search, backHref, rooms: initialRooms, seasons, services, settings, prefill, signedIn, demoCards }: Props) {
  const { state, pending, formProps } = useActionForm(bookAction, null);
  const [rooms, setRooms] = useState(initialRooms.map((r) => ({ ...r, occupantName: "" })));
  const [extras, setExtras] = useState<string[]>([]);
  const [payment, setPayment] = useState<"card" | "hotel">("card");
  const [company, setCompany] = useState(false);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const e = state?.fieldErrors;
  const multi = rooms.length > 1;

  // Mirrors the server: per-guest extras on every room, other extras once on the first room.
  const quotes = useMemo(() => {
    const parsedSeasons = seasons.map((s) => ({ ...s, startDate: new Date(s.startDate), endDate: new Date(s.endDate) }));
    return rooms.map((r, i) =>
      quoteStay({
        roomType: { id: r.roomTypeId, baseRate: r.baseRate, weekendRate: r.weekendRate },
        seasons: parsedSeasons,
        checkIn: parseISODate(search.checkIn),
        checkOut: parseISODate(search.checkOut),
        adults: r.adults,
        children: r.children,
        extras: services.filter((s) => extras.includes(s.id) && (s.perGuest || i === 0)),
        cityTaxPerPersonNight: settings.cityTax,
        vatRate: settings.vatRate,
      }),
    );
  }, [rooms, seasons, services, extras, search, settings]);
  const total = round2(quotes.reduce((s, q) => s + q.total, 0));
  const roomTotal = round2(quotes.reduce((s, q) => s + q.roomTotal, 0));
  const cityTax = round2(quotes.reduce((s, q) => s + q.cityTax, 0));
  const vat = round2(quotes.reduce((s, q) => s + q.vatIncluded, 0));
  const nights = quotes[0]?.nightCount ?? 0;
  const extraLines = services
    .filter((s) => extras.includes(s.id))
    .map((s) => {
      const lines = quotes.flatMap((q) => q.extras.filter((x) => x.serviceId === s.id));
      return { id: s.id, name: s.name, quantity: lines.reduce((n, x) => n + x.quantity, 0), amount: round2(lines.reduce((n, x) => n + x.amount, 0)) };
    });

  const setRoom = (i: number, patch: Partial<(typeof rooms)[number]>) => setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggle = (id: string) => setExtras((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const formatCardNumber = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  const loginHref = `/login?next=${encodeURIComponent(backHref.replace("/book?", "/book/checkout?"))}`;

  return (
    <form {...formProps} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="checkIn" value={search.checkIn} />
      <input type="hidden" name="checkOut" value={search.checkOut} />
      <input type="hidden" name="rooms" value={JSON.stringify(rooms.map((r) => ({ slug: r.slug, adults: r.adults, children: r.children, occupantName: r.occupantName })))} />
      {extras.map((id) => (
        <input key={id} type="hidden" name="extras" value={id} />
      ))}
      <input type="hidden" name="payment" value={payment} />

      <div className="space-y-6">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" /> Change room selection
        </Link>
        <FormMessage state={state} />

        <Section title={multi ? `Your ${rooms.length} rooms` : "Your room"} description={multi ? "Tell us who is staying in each room." : undefined}>
          <div className="space-y-3">
            {rooms.map((r, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                  <Image src={r.image} alt={r.name} fill sizes="96px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {multi && <span className="text-muted-foreground">Room {i + 1} · </span>}
                    {r.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sleeps {r.maxAdults} adults + {r.maxChildren} children · {formatMoney(quotes[i]?.roomTotal ?? 0)} for {pluralize(nights, "night")}
                  </p>
                  {multi && (
                    <Input
                      value={r.occupantName}
                      onChange={(ev) => setRoom(i, { occupantName: ev.target.value })}
                      placeholder="Guest name for this room (optional)"
                      aria-label={`Guest name for room ${i + 1}`}
                      maxLength={80}
                      className="mt-2 h-9"
                    />
                  )}
                </div>
                <div className="flex gap-3">
                  <label className="text-xs text-muted-foreground">
                    Adults
                    <Select value={r.adults} onChange={(ev) => setRoom(i, { adults: Number(ev.target.value) })} className="mt-1 h-9 w-20">
                      {Array.from({ length: r.maxAdults }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Children
                    <Select value={r.children} onChange={(ev) => setRoom(i, { children: Number(ev.target.value) })} className="mt-1 h-9 w-20" disabled={r.maxChildren === 0}>
                      {Array.from({ length: r.maxChildren + 1 }, (_, n) => n).map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title={multi ? "Lead guest" : "Guest details"} description={signedIn ? "We've pre-filled your details from your account." : multi ? "The person making the booking; confirmations are sent to them." : undefined}>
          {!signedIn && (
            <p className="mb-5 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              Have an account?{" "}
              <Link href={loginHref} className="font-medium text-primary underline-offset-4 hover:underline">
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
            <Textarea id="specialRequests" name="specialRequests" placeholder={multi ? "E.g. adjoining rooms, same floor, celebrating together…" : "E.g. high floor, extra pillows, celebrating an anniversary…"} maxLength={500} />
          </Field>

          <label className={cn("mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors", company ? "border-gold bg-gold-soft/40" : "border-border hover:border-gold/40")}>
            <Checkbox name="company" checked={company} onChange={(ev) => setCompany(ev.target.checked)} className="mt-0.5" />
            <span>
              <span className="flex items-center gap-2 font-medium"><Building2 className="size-4 text-gold" /> I need an invoice for my company</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">The invoice will be issued to your company with its tax number (NIPT / VAT ID).</span>
            </span>
          </label>
          {company && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Company name" htmlFor="companyName" error={e?.companyName}>
                <Input id="companyName" name="companyName" autoComplete="organization" required />
              </Field>
              <Field label="Tax number (NIPT / VAT ID)" htmlFor="companyTaxId" error={e?.companyTaxId}>
                <Input id="companyTaxId" name="companyTaxId" placeholder="E.g. L12345678A" className="uppercase" required />
              </Field>
              <Field label="Company address" htmlFor="companyAddress" error={e?.companyAddress} className="sm:col-span-2">
                <Input id="companyAddress" name="companyAddress" autoComplete="street-address" required />
              </Field>
              <Field label="City" htmlFor="companyCity" error={e?.companyCity}>
                <Input id="companyCity" name="companyCity" autoComplete="address-level2" />
              </Field>
              <Field label="Country" htmlFor="companyCountry" error={e?.companyCountry}>
                <Select id="companyCountry" name="companyCountry" defaultValue="Albania">
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </Section>

        <Section title="Enhance your stay" description={multi ? "Per-guest extras apply to every room; others are added once." : "Optional extras, added to your reservation."}>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => {
              const on = extras.includes(s.id);
              return (
                <label key={s.id} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors", on ? "border-gold bg-gold-soft/50" : "border-border hover:border-gold/40")}>
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
                className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 text-left transition-colors", payment === value ? "border-primary bg-white ring-1 ring-primary" : "border-border bg-white hover:border-primary/40")}
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
            I accept the booking conditions: free cancellation up to {settings.freeCancellationHours} hours before arrival; later cancellations and no-shows are charged
            the first night{multi ? " of each room" : ""}.
          </span>
        </label>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-lg shadow-primary/5">
          <div className="relative aspect-[16/9]">
            <Image src={rooms[0]!.image} alt={rooms[0]!.name} fill sizes="380px" className="object-cover" />
            {multi && <span className="absolute bottom-3 left-3 rounded-full bg-primary/85 px-3 py-1 text-xs font-medium text-white">{rooms.length} rooms</span>}
          </div>
          <div className="p-6">
            <p className="font-serif text-2xl text-primary">{multi ? `${rooms.length} rooms` : rooms[0]!.name}</p>
            {multi && (
              <ul className="mt-1 text-sm text-muted-foreground">
                {Object.entries(rooms.reduce<Record<string, number>>((m, r) => ({ ...m, [r.name]: (m[r.name] ?? 0) + 1 }), {})).map(([name, n]) => (
                  <li key={name}>{n} × {name}</li>
                ))}
              </ul>
            )}
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
              {pluralize(nights, "night")} · {pluralize(rooms.reduce((s, r) => s + r.adults, 0), "adult")}
              {rooms.some((r) => r.children) ? `, ${pluralize(rooms.reduce((s, r) => s + r.children, 0), "child", "children")}` : ""}
            </p>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{multi ? `Rooms (${rooms.length} × ${pluralize(nights, "night")})` : `Room (${pluralize(nights, "night")})`}</dt>
                <dd>{formatMoney(roomTotal)}</dd>
              </div>
              {extraLines.map((x) => (
                <div key={x.id} className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {x.name}
                    {x.quantity > 1 ? ` × ${x.quantity}` : ""}
                  </dt>
                  <dd>{formatMoney(x.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">City tax</dt>
                <dd>{formatMoney(cityTax)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="text-primary">{formatMoney(total)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">Includes {formatMoney(vat)} VAT</p>
            </dl>
            <SubmitButton pending={pending} size="lg" className="mt-6 w-full" pendingText={payment === "card" ? "Processing payment…" : "Confirming…"}>
              {payment === "card" ? `Pay ${formatMoney(total)} & confirm` : "Confirm reservation"}
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
