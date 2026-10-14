"use client";

import { ActionForm } from "@/components/action-ui";
import { Field, Input, SubmitButton } from "@/components/ui/form";
import { saveSettingsAction } from "./actions";

type Values = Record<"name" | "legalName" | "taxId" | "email" | "phone" | "address" | "city" | "country" | "vatRate" | "cityTaxPerPersonNight" | "checkInTime" | "checkOutTime" | "freeCancellationHours", string>;

export function SettingsForm({ values }: { values: Values }) {
  const f = (name: keyof Values, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field label={label} htmlFor={`st-${name}`}>
      <Input id={`st-${name}`} name={name} defaultValue={values[name]} required {...props} />
    </Field>
  );
  return (
    <ActionForm action={saveSettingsAction} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        {f("name", "Hotel name")}
        {f("legalName", "Legal entity name")}
        {f("taxId", "Tax ID (NIPT)")}
        {f("email", "Reservations email", { type: "email" })}
        {f("phone", "Phone")}
        {f("address", "Street address")}
        {f("city", "City")}
        {f("country", "Country")}
      </section>
      <section>
        <p className="mb-3 text-sm font-semibold">Taxes & policies</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {f("vatRate", "VAT rate (%)", { type: "number", step: "0.01", min: 0, max: 50 })}
          {f("cityTaxPerPersonNight", "City tax (€ / adult / night)", { type: "number", step: "0.01", min: 0 })}
          {f("freeCancellationHours", "Free cancellation (hours)", { type: "number", min: 0, max: 720 })}
          {f("checkInTime", "Check-in from", { type: "time" })}
          {f("checkOutTime", "Check-out until", { type: "time" })}
        </div>
      </section>
      <SubmitButton>Save settings</SubmitButton>
    </ActionForm>
  );
}
