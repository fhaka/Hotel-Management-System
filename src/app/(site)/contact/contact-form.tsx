"use client";

import { CheckCircle2 } from "lucide-react";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea, useActionForm } from "@/components/ui/form";
import { sendContactMessage } from "./actions";

export function ContactForm() {
  const { state, pending, formProps } = useActionForm(sendContactMessage, null);
  const e = state?.fieldErrors;

  if (state?.success) {
    return (
      <div className="mt-10 flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <p className="mt-4 font-serif text-2xl text-primary">Thank you!</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{state.success}</p>
      </div>
    );
  }

  return (
    <form {...formProps} className="mt-6 space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={e?.name}>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email" error={e?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={e?.phone}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label="Topic" htmlFor="subject" error={e?.subject}>
          <Select id="subject" name="subject" defaultValue="Reservation enquiry">
            {["Reservation enquiry", "Group or event booking", "Restaurant reservation", "Spa appointment", "Existing booking", "Other"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Message" htmlFor="message" error={e?.message}>
        <Textarea id="message" name="message" rows={6} required minLength={10} maxLength={2000} />
      </Field>
      {/* Honeypot field for bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <SubmitButton pending={pending} size="lg" pendingText="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
