"use client";

import { useEffect, useState, useTransition } from "react";
import { Crown, Loader2, Search, UserPlus, X } from "lucide-react";
import { ROOM_STATUS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { COUNTRIES } from "@/lib/countries";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createReservationAction } from "../actions";
import { checkAvailability, searchGuests } from "./lookup";

type Guest = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; country: string | null; vip: boolean };
type Avail = Awaited<ReturnType<typeof checkAvailability>>;

export function NewReservationForm({
  today,
  defaults,
  roomTypes,
  services,
  initialGuest,
}: {
  today: string;
  defaults: { checkIn: string; checkOut: string; roomTypeId: string };
  roomTypes: { id: string; name: string; maxAdults: number; maxChildren: number; baseRate: number }[];
  services: { id: string; name: string; price: number; unit: string }[];
  initialGuest: Guest | null;
}) {
  const { state, pending, formProps } = useActionForm(createReservationAction, null);
  const [guest, setGuest] = useState<Guest | null>(initialGuest);
  const [newGuest, setNewGuest] = useState(false);
  const [stay, setStay] = useState({ ...defaults, adults: 2, children: 0 });
  const [extras, setExtras] = useState<string[]>([]);
  const [roomId, setRoomId] = useState("");
  const [avail, setAvail] = useState<Avail>(null);
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    startCheck(async () => {
      const result = await checkAvailability({ ...stay, extras });
      setAvail(result);
      setRoomId((current) => (result?.rooms.some((r) => r.id === current) ? current : ""));
    });
  }, [stay, extras]);

  const type = roomTypes.find((t) => t.id === stay.roomTypeId);
  const set = (patch: Partial<typeof stay>) => setStay((s) => ({ ...s, ...patch }));

  return (
    <form {...formProps} className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <FormMessage state={state} />
        <Card>
          <CardHeader title="Guest" description="Search the guest database or add a new guest." />
          <CardBody>
            {guest ? (
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface/60 p-4">
                <input type="hidden" name="guestId" value={guest.id} />
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {guest.firstName} {guest.lastName}
                    {guest.vip && <Crown className="size-4 text-gold" />}
                  </p>
                  <p className="text-sm text-muted-foreground">{[guest.email, guest.phone, guest.country].filter(Boolean).join(" · ")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setGuest(null)}>
                  <X /> Change
                </Button>
              </div>
            ) : newGuest ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" htmlFor="firstName"><Input id="firstName" name="firstName" required /></Field>
                  <Field label="Last name" htmlFor="lastName"><Input id="lastName" name="lastName" required /></Field>
                  <Field label="Email" htmlFor="email" hint="Needed to send confirmations."><Input id="email" name="email" type="email" /></Field>
                  <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" /></Field>
                  <Field label="Country" htmlFor="country">
                    <Select id="country" name="country" defaultValue="">
                      <option value="">—</option>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </Select>
                  </Field>
                </div>
                <Button variant="link" size="sm" onClick={() => setNewGuest(false)}>Search existing guests instead</Button>
              </div>
            ) : (
              <GuestSearch onPick={setGuest} onNew={() => setNewGuest(true)} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stay" />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Check-in" htmlFor="checkIn">
                <Input id="checkIn" name="checkIn" type="date" min={today} value={stay.checkIn} onChange={(e) => set({ checkIn: e.target.value, checkOut: e.target.value >= stay.checkOut ? addDay(e.target.value) : stay.checkOut })} required />
              </Field>
              <Field label="Check-out" htmlFor="checkOut">
                <Input id="checkOut" name="checkOut" type="date" min={addDay(stay.checkIn)} value={stay.checkOut} onChange={(e) => set({ checkOut: e.target.value })} required />
              </Field>
              <Field label="Adults" htmlFor="adults">
                <Input id="adults" name="adults" type="number" min={1} max={type?.maxAdults ?? 4} value={stay.adults} onChange={(e) => set({ adults: Number(e.target.value) })} required />
              </Field>
              <Field label="Children" htmlFor="children">
                <Input id="children" name="children" type="number" min={0} max={type?.maxChildren ?? 2} value={stay.children} onChange={(e) => set({ children: Number(e.target.value) })} required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Room type" htmlFor="roomTypeId">
                <Select id="roomTypeId" name="roomTypeId" value={stay.roomTypeId} onChange={(e) => set({ roomTypeId: e.target.value })}>
                  {roomTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — from {formatMoney(t.baseRate)} (max {t.maxAdults}+{t.maxChildren})</option>
                  ))}
                </Select>
              </Field>
              <Field label="Booking channel" htmlFor="source">
                <Select id="source" name="source" defaultValue="PHONE">
                  <option value="PHONE">Phone</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="EMAIL">Email</option>
                  <option value="CORPORATE">Corporate</option>
                  <option value="OTA">Online travel agency</option>
                </Select>
              </Field>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                Room {checking && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </p>
              <input type="hidden" name="roomId" value={roomId} />
              {avail && avail.rooms.length === 0 ? (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">No {type?.name} is available for these dates.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setRoomId("")} className={cn("cursor-pointer rounded-lg border px-3 py-2 text-sm", roomId === "" ? "border-primary bg-primary text-white" : "border-border hover:bg-muted")}>
                    Auto-assign
                  </button>
                  {avail?.rooms.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoomId(r.id)}
                      title={ROOM_STATUS[r.status].label}
                      className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm", roomId === r.id ? "border-primary bg-primary text-white" : "border-border hover:bg-muted")}
                    >
                      <span className={`size-1.5 rounded-full ${ROOM_STATUS[r.status].dot}`} /> {r.number}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Extras & notes" />
          <CardBody className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold-soft/40">
                  <Checkbox name="extras" value={s.id} checked={extras.includes(s.id)} onChange={(e) => setExtras((xs) => (e.target.checked ? [...xs, s.id] : xs.filter((x) => x !== s.id)))} />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-muted-foreground">{formatMoney(s.price)} / {s.unit}</span>
                </label>
              ))}
            </div>
            <Field label="Guest requests" htmlFor="specialRequests"><Textarea id="specialRequests" name="specialRequests" rows={2} /></Field>
            <Field label="Internal notes" htmlFor="internalNotes"><Textarea id="internalNotes" name="internalNotes" rows={2} /></Field>
          </CardBody>
        </Card>
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader title="Summary" />
          <CardBody>
            {avail ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Room ({avail.nights} nights)</dt><dd>{formatMoney(avail.roomTotal)}</dd></div>
                {avail.extrasTotal > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Extras</dt><dd>{formatMoney(avail.extrasTotal)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">City tax</dt><dd>{formatMoney(avail.cityTax)}</dd></div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(avail.total)}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Choose dates to see the price.</p>
            )}
            <label className="mt-5 flex items-center gap-2 text-sm">
              <Checkbox name="sendConfirmation" defaultChecked /> Email confirmation to guest
            </label>
            <SubmitButton pending={pending} className="mt-5 w-full" size="lg" disabled={!avail || avail.rooms.length === 0 || (!guest && !newGuest)} pendingText="Creating…">
              Create reservation
            </SubmitButton>
            {!guest && !newGuest && <p className="mt-2 text-center text-xs text-muted-foreground">Select or add a guest first.</p>}
          </CardBody>
        </Card>
      </div>
    </form>
  );
}

function addDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function GuestSearch({ onPick, onNew }: { onPick: (g: Guest) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Guest[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => start(async () => setResults(q.trim().length >= 2 ? await searchGuests(q) : [])), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or phone…" className="pl-9" autoFocus />
          {pending && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <Button variant="outline" onClick={onNew}>
          <UserPlus /> New guest
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {results.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => onPick(g)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted">
                <span className="font-medium">
                  {g.firstName} {g.lastName} {g.vip && <Crown className="ml-1 inline size-3.5 text-gold" />}
                </span>
                <span className="text-muted-foreground">{g.email ?? g.phone ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !pending && results.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No guests found. Add a new guest instead.</p>}
    </div>
  );
}
