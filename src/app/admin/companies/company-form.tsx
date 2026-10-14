"use client";

import { Building2, Plus } from "lucide-react";
import { ActionForm, FormDialog } from "@/components/action-ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { COUNTRIES } from "@/lib/countries";
import { saveCompanyAction, setReservationCompanyAction } from "./actions";

export type CompanyValues = { name: string; taxId: string; contactName: string; email: string; phone: string; address: string; city: string; country: string; notes: string };

const EMPTY: CompanyValues = { name: "", taxId: "", contactName: "", email: "", phone: "", address: "", city: "", country: "Albania", notes: "" };

function CompanyFields({ values, prefix }: { values: CompanyValues; prefix: string }) {
  const id = (n: string) => `${prefix}-${n}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor={id("name")} className="sm:col-span-2"><Input id={id("name")} name="name" defaultValue={values.name} required /></Field>
        <Field label="Tax number (NIPT / VAT ID)" htmlFor={id("tax")}><Input id={id("tax")} name="taxId" defaultValue={values.taxId} className="uppercase" placeholder="L12345678A" /></Field>
        <Field label="Contact person" htmlFor={id("contact")}><Input id={id("contact")} name="contactName" defaultValue={values.contactName} /></Field>
        <Field label="Billing email" htmlFor={id("email")}><Input id={id("email")} name="email" type="email" defaultValue={values.email} /></Field>
        <Field label="Phone" htmlFor={id("phone")}><Input id={id("phone")} name="phone" defaultValue={values.phone} /></Field>
        <Field label="Address" htmlFor={id("address")} className="sm:col-span-2"><Input id={id("address")} name="address" defaultValue={values.address} /></Field>
        <Field label="City" htmlFor={id("city")}><Input id={id("city")} name="city" defaultValue={values.city} /></Field>
        <Field label="Country" htmlFor={id("country")}>
          <Select id={id("country")} name="country" defaultValue={values.country}>
            <option value="">—</option>
            {[...new Set([...(values.country ? [values.country] : []), ...COUNTRIES])].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes (agreed rates, payment terms…)" htmlFor={id("notes")}><Textarea id={id("notes")} name="notes" defaultValue={values.notes} rows={3} /></Field>
    </div>
  );
}

export function NewCompanyDialog() {
  return (
    <FormDialog trigger={<Button><Plus /> New company</Button>} title="New company" action={saveCompanyAction.bind(null, null)} submitLabel="Create company" className="max-w-2xl">
      <CompanyFields values={EMPTY} prefix="new" />
    </FormDialog>
  );
}

export function EditCompanyForm({ id, values }: { id: string; values: CompanyValues }) {
  return (
    <ActionForm action={saveCompanyAction.bind(null, id)} className="space-y-4">
      <CompanyFields values={values} prefix="edit" />
      <SubmitButton>Save company</SubmitButton>
    </ActionForm>
  );
}

export function BillToDialog({ reservationId, current, companies }: { reservationId: string; current: string | null; companies: { id: string; name: string; taxId: string | null }[] }) {
  return (
    <FormDialog
      trigger={<button className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"><Building2 className="size-3" /> Change</button>}
      title="Invoice to"
      description="Choose who the invoice for this stay is addressed to."
      action={setReservationCompanyAction.bind(null, reservationId)}
    >
      <Field label="Bill to" htmlFor="bt-company" hint="Add new companies under Front office → Companies.">
        <Select id="bt-company" name="companyId" defaultValue={current ?? ""}>
          <option value="">The guest (private)</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.taxId ? ` · ${c.taxId}` : ""}
            </option>
          ))}
        </Select>
      </Field>
    </FormDialog>
  );
}
