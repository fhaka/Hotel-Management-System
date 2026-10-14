"use client";

import { Field, FormMessage, Input, Select, SubmitButton, useActionForm } from "@/components/ui/form";
import { COUNTRIES } from "@/lib/countries";
import { changePassword, updateProfile } from "./actions";

type Values = { firstName: string; lastName: string; email: string; phone: string; country: string; city: string; address: string };

export function ProfileForm({ values }: { values: Values }) {
  const { state, pending, formProps } = useActionForm(updateProfile, null);
  const e = state?.fieldErrors;
  return (
    <form {...formProps} className="mt-6 space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={e?.firstName}>
          <Input id="firstName" name="firstName" defaultValue={values.firstName} required />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={e?.lastName}>
          <Input id="lastName" name="lastName" defaultValue={values.lastName} required />
        </Field>
      </div>
      <Field label="Email" htmlFor="email" hint="Contact the hotel to change your sign-in email.">
        <Input id="email" value={values.email} disabled />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" error={e?.phone}>
          <Input id="phone" name="phone" defaultValue={values.phone} />
        </Field>
        <Field label="Country" htmlFor="country">
          <Select id="country" name="country" defaultValue={values.country}>
            <option value="">—</option>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={values.city} />
        </Field>
        <Field label="Address" htmlFor="address">
          <Input id="address" name="address" defaultValue={values.address} />
        </Field>
      </div>
      <SubmitButton pending={pending} pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const { state, pending, formProps } = useActionForm(changePassword, null);
  const e = state?.fieldErrors;
  return (
    <form {...formProps} className="mt-6 space-y-4">
      <FormMessage state={state} />
      <Field label="Current password" htmlFor="current" error={e?.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="password" error={e?.password} hint="8+ characters, letters and numbers">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={e?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pending={pending} pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}
