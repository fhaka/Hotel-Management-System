"use client";

import { ActionForm } from "@/components/action-ui";
import { SubmitButton } from "@/components/ui/form";
import { updateGuestAction } from "../actions";
import { GuestFields, type GuestValues } from "../guest-fields";

export function GuestEditForm({ id, values }: { id: string; values: GuestValues }) {
  return (
    <ActionForm action={updateGuestAction.bind(null, id)} className="space-y-4">
      <GuestFields values={values} />
      <SubmitButton>Save profile</SubmitButton>
    </ActionForm>
  );
}
