"use client";

import { CheckCircle2 } from "lucide-react";
import { StarInput } from "@/components/stars";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea, useActionForm } from "@/components/ui/form";
import { COUNTRIES } from "@/lib/countries";
import { submitReview } from "./actions";

export function ReviewForm({ token, defaults }: { token: string; defaults: { guestName: string; country: string } }) {
  const { state, pending, formProps } = useActionForm(submitReview.bind(null, token), null);
  const e = state?.fieldErrors;

  if (state?.success) {
    return (
      <div className="mt-8 rounded-2xl border border-border bg-white p-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <p className="mt-4 font-serif text-3xl text-primary">Thank you!</p>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{state.success}</p>
        <ButtonLink href="/" variant="outline" className="mt-6">Back to Hotel Imperial</ButtonLink>
      </div>
    );
  }

  return (
    <form {...formProps} className="mt-8 space-y-6 rounded-2xl border border-border bg-white p-6 sm:p-8">
      <FormMessage state={state} />
      <StarInput name="rating" label="Overall rating" required />
      <div className="grid gap-5 rounded-xl bg-muted/50 p-5 sm:grid-cols-2">
        <StarInput name="ratingRooms" label="Rooms" size="md" />
        <StarInput name="ratingService" label="Service" size="md" />
        <StarInput name="ratingCleanliness" label="Cleanliness" size="md" />
        <StarInput name="ratingValue" label="Value for money" size="md" />
      </div>
      <Field label="Title" htmlFor="title" error={e?.title}>
        <Input id="title" name="title" placeholder="Sum up your stay in a few words" maxLength={100} required />
      </Field>
      <Field label="Your review" htmlFor="body" error={e?.body} hint="What did you enjoy? What could we do better?">
        <Textarea id="body" name="body" rows={6} minLength={20} maxLength={3000} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shown as" htmlFor="guestName" error={e?.guestName} hint="We only show your first name and initial by default.">
          <Input id="guestName" name="guestName" defaultValue={defaults.guestName} maxLength={60} required />
        </Field>
        <Field label="Country" htmlFor="country">
          <Select id="country" name="country" defaultValue={defaults.country}>
            <option value="">Prefer not to say</option>
            {[...new Set([...(defaults.country ? [defaults.country] : []), ...COUNTRIES])].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <Checkbox name="consent" required className="mt-0.5" />
        <span>I agree that Hotel Imperial may publish this review on its website. Reviews are checked by our team before they appear.</span>
      </label>
      <SubmitButton pending={pending} size="lg" pendingText="Sending…">Submit review</SubmitButton>
    </form>
  );
}
