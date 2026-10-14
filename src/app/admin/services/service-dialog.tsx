"use client";

import { Pencil, Plus } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { SERVICE_CATEGORY } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveServiceAction } from "./actions";

type Service = { id: string; name: string; category: string; description: string; price: number; unit: string; bookable: boolean; perNight: boolean; perGuest: boolean; active: boolean };

export function ServiceDialog({ service }: { service?: Service }) {
  const p = service?.id ?? "new";
  return (
    <FormDialog
      trigger={service ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${service.name}`}><Pencil /></Button> : <Button><Plus /> Add service</Button>}
      title={service ? `Edit ${service.name}` : "Add a service"}
      action={saveServiceAction.bind(null, service?.id ?? null)}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" htmlFor={`sv-name-${p}`} className="col-span-2"><Input id={`sv-name-${p}`} name="name" defaultValue={service?.name} required /></Field>
        <Field label="Category" htmlFor={`sv-cat-${p}`}>
          <Select id={`sv-cat-${p}`} name="category" defaultValue={service?.category ?? "OTHER"}>
            {Object.entries(SERVICE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Unit" htmlFor={`sv-unit-${p}`}><Input id={`sv-unit-${p}`} name="unit" defaultValue={service?.unit ?? "item"} required /></Field>
        <Field label="Price (€, incl. VAT)" htmlFor={`sv-price-${p}`}><Input id={`sv-price-${p}`} name="price" type="number" step="0.01" min={0} defaultValue={service?.price} required /></Field>
      </div>
      <Field label="Description" htmlFor={`sv-desc-${p}`}><Textarea id={`sv-desc-${p}`} name="description" defaultValue={service?.description} rows={2} /></Field>
      <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
        <label className="flex items-center gap-2"><Checkbox name="bookable" defaultChecked={service?.bookable} /> Offer as an add-on in online booking</label>
        <label className="flex items-center gap-2"><Checkbox name="perNight" defaultChecked={service?.perNight} /> Charged per night</label>
        <label className="flex items-center gap-2"><Checkbox name="perGuest" defaultChecked={service?.perGuest} /> Charged per guest</label>
        {service && <label className="flex items-center gap-2"><Checkbox name="active" defaultChecked={service.active} /> Active</label>}
      </div>
    </FormDialog>
  );
}
