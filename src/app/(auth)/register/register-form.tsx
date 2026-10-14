"use client";

import { Field, FormMessage, Input, SubmitButton, useActionForm } from "@/components/ui/form";
import { register } from "../actions";

export function RegisterForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useActionForm(register, null);
  const e = state?.fieldErrors;

  return (
    <form {...formProps} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={e?.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={e?.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>
      <Field label="Email" htmlFor="email" error={e?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" error={e?.phone}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" error={e?.password} hint="8+ characters, letters and numbers">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={e?.confirm}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <SubmitButton pending={pending} className="w-full" size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
