"use client";

import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { COUNTRIES } from "@/lib/countries";

export type GuestValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  idType: string;
  idNumber: string;
  dateOfBirth: string;
  notes: string;
  vip: boolean;
};

export const EMPTY_GUEST: GuestValues = { firstName: "", lastName: "", email: "", phone: "", country: "", city: "", address: "", idType: "", idNumber: "", dateOfBirth: "", notes: "", vip: false };

export function GuestFields({ values }: { values: GuestValues }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="g-first"><Input id="g-first" name="firstName" defaultValue={values.firstName} required /></Field>
        <Field label="Last name" htmlFor="g-last"><Input id="g-last" name="lastName" defaultValue={values.lastName} required /></Field>
        <Field label="Email" htmlFor="g-email"><Input id="g-email" name="email" type="email" defaultValue={values.email} /></Field>
        <Field label="Phone" htmlFor="g-phone"><Input id="g-phone" name="phone" defaultValue={values.phone} /></Field>
        <Field label="Country" htmlFor="g-country">
          <Select id="g-country" name="country" defaultValue={values.country}>
            <option value="">—</option>
            {[...new Set([...(values.country ? [values.country] : []), ...COUNTRIES])].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="City" htmlFor="g-city"><Input id="g-city" name="city" defaultValue={values.city} /></Field>
        <Field label="Address" htmlFor="g-address" className="sm:col-span-2"><Input id="g-address" name="address" defaultValue={values.address} /></Field>
        <Field label="ID document" htmlFor="g-idtype">
          <Select id="g-idtype" name="idType" defaultValue={values.idType}>
            <option value="">—</option>
            <option>Passport</option>
            <option>National ID card</option>
            <option>Driving licence</option>
          </Select>
        </Field>
        <Field label="Document number" htmlFor="g-idnum"><Input id="g-idnum" name="idNumber" defaultValue={values.idNumber} /></Field>
        <Field label="Date of birth" htmlFor="g-dob"><Input id="g-dob" name="dateOfBirth" type="date" defaultValue={values.dateOfBirth} /></Field>
      </div>
      <Field label="Preferences & notes" htmlFor="g-notes" hint="Visible to staff only — e.g. allergies, room preferences.">
        <Textarea id="g-notes" name="notes" defaultValue={values.notes} rows={3} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="vip" defaultChecked={values.vip} /> VIP guest
      </label>
    </div>
  );
}
