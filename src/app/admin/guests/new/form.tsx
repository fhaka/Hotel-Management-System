"use client";

import { FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { createGuestAction } from "../actions";
import { EMPTY_GUEST, GuestFields } from "../guest-fields";

export function NewGuestForm() {
  const { state, pending, formProps } = useActionForm(createGuestAction, null);
  return (
    <form {...formProps} className="space-y-4">
      <FormMessage state={state} />
      <GuestFields values={EMPTY_GUEST} />
      <SubmitButton pending={pending} pendingText="Creating…">Create guest</SubmitButton>
    </form>
  );
}
