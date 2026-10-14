"use client";

import { Pencil } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { saveRoomTypeAction } from "../actions";

type Values = {
  name: string;
  tagline: string;
  description: string;
  baseRate: number;
  weekendRate: number | null;
  maxAdults: number;
  maxChildren: number;
  sizeSqm: number;
  bedType: string;
  view: string;
  amenities: string;
  images: string;
  active: boolean;
};

export function EditRoomTypeDialog({ id, values }: { id: string; values: Values }) {
  return (
    <FormDialog
      trigger={<Button variant="outline" size="sm"><Pencil /> Edit type & rates</Button>}
      title={`Edit ${values.name}`}
      description="Rate changes apply to new bookings and modifications; existing folios are not re-priced."
      action={saveRoomTypeAction.bind(null, id)}
      className="max-w-2xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="rt-name"><Input id="rt-name" name="name" defaultValue={values.name} required /></Field>
        <Field label="Tagline" htmlFor="rt-tag"><Input id="rt-tag" name="tagline" defaultValue={values.tagline} /></Field>
        <Field label="Weekday rate (€)" htmlFor="rt-base"><Input id="rt-base" name="baseRate" type="number" step="0.01" min={1} defaultValue={values.baseRate} required /></Field>
        <Field label="Fri & Sat rate (€)" htmlFor="rt-wk" hint="Leave empty to use the weekday rate."><Input id="rt-wk" name="weekendRate" type="number" step="0.01" min={1} defaultValue={values.weekendRate ?? ""} /></Field>
        <Field label="Max adults" htmlFor="rt-ad"><Input id="rt-ad" name="maxAdults" type="number" min={1} defaultValue={values.maxAdults} required /></Field>
        <Field label="Max children" htmlFor="rt-ch"><Input id="rt-ch" name="maxChildren" type="number" min={0} defaultValue={values.maxChildren} required /></Field>
        <Field label="Size (m²)" htmlFor="rt-size"><Input id="rt-size" name="sizeSqm" type="number" min={5} defaultValue={values.sizeSqm} required /></Field>
        <Field label="Bed" htmlFor="rt-bed"><Input id="rt-bed" name="bedType" defaultValue={values.bedType} required /></Field>
        <Field label="View" htmlFor="rt-view" className="sm:col-span-2"><Input id="rt-view" name="view" defaultValue={values.view} /></Field>
      </div>
      <Field label="Description" htmlFor="rt-desc"><Textarea id="rt-desc" name="description" defaultValue={values.description} rows={4} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amenities (one per line)" htmlFor="rt-am"><Textarea id="rt-am" name="amenities" defaultValue={values.amenities} rows={6} /></Field>
        <Field label="Image URLs (one per line)" htmlFor="rt-img" hint="images.unsplash.com or /public paths"><Textarea id="rt-img" name="images" defaultValue={values.images} rows={6} className="font-mono text-xs" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="active" defaultChecked={values.active} /> Show on website and allow bookings
      </label>
    </FormDialog>
  );
}
