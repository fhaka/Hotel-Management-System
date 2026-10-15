"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, Crown, Loader2, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";
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
type RoomType = { id: string; name: string; maxAdults: number; maxChildren: number; baseRate: number };
type Line = { key: number; roomTypeId: string; adults: number; children: number; roomId: string; occupantName: string };

let nextKey = 1;

export function NewReservationForm({
  today,
  defaults,
  roomTypes,
  services,
  companies,
  initialCompanyId,
  group,
  initialGuest,
}: {
  today: string;
  defaults: { checkIn: string; checkOut: string; roomTypeId: string };
  roomTypes: RoomType[];
  services: { id: string; name: string; price: number; unit: string }[];
  companies: { id: string; name: string; taxId: string | null }[];
  initialCompanyId: string;
  group: { id: string; code: string; name: string; company: string | null } | null;
  initialGuest: Guest | null;
}) {
  const { state, pending, formProps } = useActionForm(createReservationAction, null);
  const [guest, setGuest] = useState<Guest | null>(initialGuest);
  const [newGuest, setNewGuest] = useState(false);
  const [dates, setDates] = useState({ checkIn: defaults.checkIn, checkOut: defaults.checkOut });
  const [lines, setLines] = useState<Line[]>([{ key: 0, roomTypeId: defaults.roomTypeId, adults: 2, children: 0, roomId: "", occupantName: "" }]);
  const [extras, setExtras] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [avail, setAvail] = useState<Avail>(null);
  const [checking, startCheck] = useTransition();
  const multi = lines.length > 1;
  const addingToGroup = !!group;

  const lineKey = JSON.stringify(lines.map((l) => [l.roomTypeId, l.adults, l.children]));
  useEffect(() => {
    startCheck(async () => {
      const result = await checkAvailability({ ...dates, lines: lines.map((l) => ({ roomTypeId: l.roomTypeId, adults: l.adults, children: l.children })), extras, promoCode: appliedPromo });
      setAvail(result);
      // Drop manual room picks that are no longer free.
      setLines((ls) => ls.map((l) => (l.roomId && !result?.free[l.roomTypeId]?.some((r) => r.id === l.roomId) ? { ...l, roomId: "" } : l)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when dates, room types, occupancy or extras change
  }, [dates, lineKey, extras, appliedPromo]);

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { key: nextKey++, roomTypeId: ls.at(-1)?.roomTypeId ?? defaults.roomTypeId, adults: 2, children: 0, roomId: "", occupantName: "" }]);
  const takenBy = (roomId: string, key: number) => lines.some((l) => l.key !== key && l.roomId === roomId);
  const ready = avail && avail.shortages.length === 0 && (guest || newGuest);

  return (
    <form {...formProps} className="grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1fr_340px]">
      <input type="hidden" name="rooms" value={JSON.stringify(lines.map(({ roomTypeId, adults, children, roomId, occupantName }) => ({ roomTypeId, adults, children, roomId, occupantName })))} />
      {group && <input type="hidden" name="groupId" value={group.id} />}
      <input type="hidden" name="promoCode" value={avail?.promo ? avail.promo.code : ""} />
      <div className="space-y-6">
        <FormMessage state={state} />
        {group ? (
          <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold-soft/50 px-4 py-3 text-sm text-[#6d5326]">
            <Users className="size-4" /> Adding to group <span className="font-medium">{group.name}</span> ({group.code})
            {initialGuest && <> · booker {initialGuest.firstName} {initialGuest.lastName}</>}
            {group.company && <> · invoiced to {group.company}</>}
          </div>
        ) : (
          <Card>
            <CardHeader title={multi ? "Booker" : "Guest"} description="Search the guest database or add a new guest." />
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
        )}

        <Card>
          <CardHeader
            title={multi ? `Stay · ${lines.length} rooms` : "Stay"}
            action={checking ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          />
          <CardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Check-in" htmlFor="checkIn">
                <Input id="checkIn" name="checkIn" type="date" min={today} value={dates.checkIn} onChange={(e) => setDates((d) => ({ checkIn: e.target.value, checkOut: e.target.value >= d.checkOut ? addDay(e.target.value) : d.checkOut }))} required />
              </Field>
              <Field label="Check-out" htmlFor="checkOut">
                <Input id="checkOut" name="checkOut" type="date" min={addDay(dates.checkIn)} value={dates.checkOut} onChange={(e) => setDates((d) => ({ ...d, checkOut: e.target.value }))} required />
              </Field>
              {!addingToGroup && (
                <Field label="Booking channel" htmlFor="source">
                  <Select id="source" name="source" defaultValue={initialCompanyId ? "CORPORATE" : "PHONE"}>
                    <option value="PHONE">Phone</option>
                    <option value="WALK_IN">Walk-in</option>
                    <option value="EMAIL">Email</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="OTA">Online travel agency</option>
                  </Select>
                </Field>
              )}
              {addingToGroup && <input type="hidden" name="source" value="PHONE" />}
            </div>

            {avail && avail.warnings.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
                <p className="font-medium">Booking rules for these dates (online bookings would be blocked):</p>
                <ul className="mt-1 list-disc pl-5">
                  {avail.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
            <div className="space-y-3">
              {lines.map((line, i) => {
                const type = roomTypes.find((t) => t.id === line.roomTypeId);
                const free = avail?.free[line.roomTypeId] ?? [];
                const short = avail?.shortages.includes(line.roomTypeId);
                return (
                  <div key={line.key} className={cn("rounded-xl border p-4", short ? "border-danger/40 bg-danger-soft/30" : "border-border")}>
                    <div className="flex flex-wrap items-end gap-3">
                      {multi && <span className="pb-2.5 text-sm font-medium text-muted-foreground">Room {i + 1}</span>}
                      <Field label="Room type" htmlFor={`rt-${line.key}`} className="min-w-52 flex-1">
                        <Select id={`rt-${line.key}`} value={line.roomTypeId} onChange={(e) => setLine(line.key, { roomTypeId: e.target.value, roomId: "" })}>
                          {roomTypes.map((t) => (
                            <option key={t.id} value={t.id}>{t.name} — from {formatMoney(t.baseRate)}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Adults" htmlFor={`ad-${line.key}`} className="w-20">
                        <Select id={`ad-${line.key}`} value={line.adults} onChange={(e) => setLine(line.key, { adults: Number(e.target.value) })}>
                          {Array.from({ length: type?.maxAdults ?? 2 }, (_, n) => n + 1).map((n) => <option key={n}>{n}</option>)}
                        </Select>
                      </Field>
                      <Field label="Children" htmlFor={`ch-${line.key}`} className="w-20">
                        <Select id={`ch-${line.key}`} value={line.children} onChange={(e) => setLine(line.key, { children: Number(e.target.value) })}>
                          {Array.from({ length: (type?.maxChildren ?? 0) + 1 }, (_, n) => n).map((n) => <option key={n}>{n}</option>)}
                        </Select>
                      </Field>
                      {avail?.lines[i] && <p className="pb-2.5 text-sm font-medium tabular-nums">{formatMoney(avail.lines[i]!.total)}</p>}
                      {multi && (
                        <Button variant="ghost" size="icon-sm" className="mb-1" aria-label={`Remove room ${i + 1}`} onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                    {(multi || addingToGroup) && (
                      <Input value={line.occupantName} onChange={(e) => setLine(line.key, { occupantName: e.target.value })} placeholder="Guest name in this room (optional)" className="mt-3 h-9" maxLength={80} />
                    )}
                    <div className="mt-3">
                      {short ? (
                        <p className="text-sm text-danger">Not enough {type?.name}s are free for these dates ({free.length} available).</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setLine(line.key, { roomId: "" })} className={cn("cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs", line.roomId === "" ? "border-primary bg-primary text-white" : "border-border hover:bg-muted")}>
                            Auto-assign
                          </button>
                          {free.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              disabled={takenBy(r.id, line.key)}
                              onClick={() => setLine(line.key, { roomId: r.id })}
                              title={ROOM_STATUS[r.status].label}
                              className={cn("flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-30", line.roomId === r.id ? "border-primary bg-primary text-white" : "border-border hover:bg-muted")}
                            >
                              <span className={`size-1.5 rounded-full ${ROOM_STATUS[r.status].dot}`} /> {r.number}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {lines.length < 8 && (
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus /> Add another room
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        {!addingToGroup && (
          <Card>
            <CardHeader title="Billing" />
            <CardBody className="space-y-4">
              <Field label="Invoice to" htmlFor="companyId" hint="Choose a company for corporate stays. Add companies under Front office → Companies.">
                <Select id="companyId" name="companyId" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">The guest (private)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.taxId ? ` · ${c.taxId}` : ""}</option>
                  ))}
                </Select>
              </Field>
              {multi && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Group name" htmlFor="groupName" hint="Shown on the group bill and calendar.">
                    <Input id="groupName" name="groupName" placeholder={companyId ? companies.find((c) => c.id === companyId)?.name : "E.g. Morgan wedding party"} />
                  </Field>
                  <label className="flex items-start gap-2 self-center text-sm">
                    <Checkbox name="singleBill" defaultChecked className="mt-0.5" />
                    <span>
                      One bill for all rooms
                      <span className="block text-xs text-muted-foreground">Settled and invoiced when the last room departs.</span>
                    </span>
                  </label>
                </div>
              )}
              {companyId && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="size-4 text-gold" /> Invoices will show the company name and tax number.</p>}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Extras & notes" description={multi ? "Per-guest extras apply to every room; others are added once." : undefined} />
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
            <Field label="Promo code" htmlFor="promoInput" error={avail?.promoError ?? undefined} hint={avail?.promo ? `${avail.promo.code}: ${avail.promo.label}` : "Optional — discounts the room rate."}>
              <div className="flex gap-2">
                <Input id="promoInput" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="max-w-56 font-mono uppercase" placeholder="E.g. WELCOME10" />
                <Button variant="outline" onClick={() => setAppliedPromo(promoCode.trim())} disabled={promoCode.trim() === appliedPromo}>
                  {appliedPromo && promoCode.trim() === "" ? "Remove" : "Apply"}
                </Button>
              </div>
            </Field>
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
                <div className="flex justify-between"><dt className="text-muted-foreground">{multi ? `${lines.length} rooms` : "Room"} ({avail.nights} nights)</dt><dd>{formatMoney(avail.roomTotal)}</dd></div>
                {avail.extrasTotal > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Extras</dt><dd>{formatMoney(avail.extrasTotal)}</dd></div>}
                {avail.discount > 0 && avail.promo && <div className="flex justify-between text-success"><dt>Promo {avail.promo.code}</dt><dd>−{formatMoney(avail.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">City tax</dt><dd>{formatMoney(avail.cityTax)}</dd></div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(avail.total)}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Choose dates to see the price.</p>
            )}
            <label className="mt-5 flex items-center gap-2 text-sm">
              <Checkbox name="sendConfirmation" defaultChecked /> Email confirmation to {addingToGroup || multi ? "booker" : "guest"}
            </label>
            <SubmitButton pending={pending} className="mt-5 w-full" size="lg" disabled={!ready} pendingText="Creating…">
              {addingToGroup ? `Add ${lines.length > 1 ? `${lines.length} rooms` : "room"} to group` : multi ? `Create group booking (${lines.length} rooms)` : "Create reservation"}
            </SubmitButton>
            {!guest && !newGuest && !addingToGroup && <p className="mt-2 text-center text-xs text-muted-foreground">Select or add a guest first.</p>}
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
