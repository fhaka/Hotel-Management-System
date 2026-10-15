"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { savePromoAction, saveRuleAction } from "./pricing-actions";

type RoomTypes = { id: string; name: string }[];

export type PromoValues = {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED_PER_NIGHT";
  value: number;
  validFrom: string;
  validTo: string;
  stayFrom: string;
  stayTo: string;
  minNights: number;
  maxUses: number | null;
  roomTypeIds: string[];
  active: boolean;
};

export function PromoDialog({ id, values, roomTypes }: { id?: string; values?: PromoValues; roomTypes: RoomTypes }) {
  const [type, setType] = useState(values?.type ?? "PERCENT");
  const p = id ?? "new";
  return (
    <FormDialog
      trigger={id ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${values?.code}`}><Pencil /></Button> : <Button size="sm"><Plus /> New promo code</Button>}
      title={id ? `Edit ${values?.code}` : "New promo code"}
      description="Discounts apply to room rates only (not extras or city tax)."
      action={savePromoAction.bind(null, id ?? null)}
      className="max-w-2xl"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code" htmlFor={`pc-code-${p}`}><Input id={`pc-code-${p}`} name="code" defaultValue={values?.code} className="font-mono uppercase" placeholder="SUMMER15" required /></Field>
        <Field label="Discount type" htmlFor={`pc-type-${p}`}>
          <Select id={`pc-type-${p}`} name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="PERCENT">% off room rate</option>
            <option value="FIXED_PER_NIGHT">€ off per night</option>
          </Select>
        </Field>
        <Field label={type === "PERCENT" ? "Percentage" : "Amount per night (€)"} htmlFor={`pc-val-${p}`}>
          <Input id={`pc-val-${p}`} name="value" type="number" step="0.01" min={0.01} max={type === "PERCENT" ? 100 : undefined} defaultValue={values?.value} required />
        </Field>
      </div>
      <Field label="Description (shown to staff)" htmlFor={`pc-desc-${p}`}><Input id={`pc-desc-${p}`} name="description" defaultValue={values?.description} placeholder="E.g. Newsletter subscribers, autumn campaign" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bookable from" htmlFor={`pc-vf-${p}`} hint="Leave empty for no limit"><Input id={`pc-vf-${p}`} name="validFrom" type="date" defaultValue={values?.validFrom} /></Field>
        <Field label="Bookable until" htmlFor={`pc-vt-${p}`}><Input id={`pc-vt-${p}`} name="validTo" type="date" defaultValue={values?.validTo} /></Field>
        <Field label="Arrivals from" htmlFor={`pc-sf-${p}`}><Input id={`pc-sf-${p}`} name="stayFrom" type="date" defaultValue={values?.stayFrom} /></Field>
        <Field label="Arrivals until" htmlFor={`pc-st-${p}`}><Input id={`pc-st-${p}`} name="stayTo" type="date" defaultValue={values?.stayTo} /></Field>
        <Field label="Minimum nights" htmlFor={`pc-min-${p}`}><Input id={`pc-min-${p}`} name="minNights" type="number" min={1} max={30} defaultValue={values?.minNights ?? 1} required /></Field>
        <Field label="Maximum uses" htmlFor={`pc-max-${p}`} hint="Leave empty for unlimited"><Input id={`pc-max-${p}`} name="maxUses" type="number" min={1} defaultValue={values?.maxUses ?? ""} /></Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Room types</legend>
        <p className="text-xs text-muted-foreground">None selected = all room types.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {roomTypes.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold-soft/50">
              <Checkbox name="roomTypeIds" value={t.id} defaultChecked={values?.roomTypeIds.includes(t.id)} /> {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      {id && <label className="flex items-center gap-2 text-sm"><Checkbox name="active" defaultChecked={values?.active} /> Active</label>}
    </FormDialog>
  );
}

export type RuleValues = {
  name: string;
  startDate: string;
  endDate: string;
  roomTypeId: string;
  weekdays: number[];
  minNights: number | null;
  closedToArrival: boolean;
  stopSell: boolean;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

export function RuleDialog({ id, values, roomTypes }: { id?: string; values?: RuleValues; roomTypes: RoomTypes }) {
  const p = id ?? "new";
  const [days, setDays] = useState<number[]>(values?.weekdays ?? []);
  return (
    <FormDialog
      trigger={id ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${values?.name}`}><Pencil /></Button> : <Button size="sm"><Plus /> New booking rule</Button>}
      title={id ? `Edit ${values?.name}` : "New booking rule"}
      description="Rules apply to online bookings. Staff can still book manually and see a warning."
      action={saveRuleAction.bind(null, id ?? null)}
      className="max-w-2xl"
    >
      <Field label="Name" htmlFor={`r-name-${p}`}><Input id={`r-name-${p}`} name="name" defaultValue={values?.name} placeholder="E.g. Weekend minimum stay" required /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First night" htmlFor={`r-start-${p}`}><Input id={`r-start-${p}`} name="startDate" type="date" defaultValue={values?.startDate} required /></Field>
        <Field label="Ends (exclusive)" htmlFor={`r-end-${p}`}><Input id={`r-end-${p}`} name="endDate" type="date" defaultValue={values?.endDate} required /></Field>
        <Field label="Room type" htmlFor={`r-type-${p}`}>
          <Select id={`r-type-${p}`} name="roomTypeId" defaultValue={values?.roomTypeId ?? ""}>
            <option value="">All room types</option>
            {roomTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Arrival days</legend>
        <p className="text-xs text-muted-foreground">Minimum stay and closed-to-arrival apply only to arrivals on these days. None selected = every day.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DAYS.map((label, i) => {
            const d = DAY_INDEX[i]!;
            const on = days.includes(d);
            return (
              <label key={label} className={cn("cursor-pointer rounded-lg border px-3 py-1.5 text-sm", on ? "border-primary bg-primary text-white" : "border-border hover:bg-muted")}>
                <input type="checkbox" name="weekdays" value={d} checked={on} onChange={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))} className="sr-only" />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-3 rounded-lg bg-muted/60 p-4 sm:grid-cols-3">
        <Field label="Minimum stay (nights)" htmlFor={`r-min-${p}`}><Input id={`r-min-${p}`} name="minNights" type="number" min={2} max={30} defaultValue={values?.minNights ?? ""} placeholder="—" /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox name="closedToArrival" defaultChecked={values?.closedToArrival} /> Closed to arrival</label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox name="stopSell" defaultChecked={values?.stopSell} /> Stop sell (closed)</label>
      </div>
    </FormDialog>
  );
}
