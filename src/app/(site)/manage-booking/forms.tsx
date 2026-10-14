"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, SubmitButton, Textarea, useActionForm } from "@/components/ui/form";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { guestCancel, lookupBooking } from "./actions";

export function LookupForm({ defaultCode }: { defaultCode?: string }) {
  const { state, pending, formProps } = useActionForm(lookupBooking, null);
  return (
    <form {...formProps} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Confirmation number" htmlFor="code">
        <Input id="code" name="code" defaultValue={defaultCode} placeholder="HIXXXXXX" className="font-mono uppercase tracking-widest" required />
      </Field>
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton pending={pending} className="w-full" size="lg" pendingText="Looking up…">
        Find my booking
      </SubmitButton>
    </form>
  );
}

export function CancelBooking({ code, free, hours, rooms = 1 }: { code: string; free: boolean; hours: number; rooms?: number }) {
  const [open, setOpen] = useState(false);
  const { state, pending, formProps } = useActionForm(guestCancel, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger-outline">
          <XCircle /> {rooms > 1 ? `Cancel all ${rooms} rooms` : "Cancel reservation"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={rooms > 1 ? `Cancel all ${rooms} rooms?` : "Cancel your reservation?"}
        description={
          free
            ? "Your reservation is within the free cancellation window. Any prepayment will be refunded in full."
            : `The free cancellation window (${hours} hours before arrival) has passed. The first night${rooms > 1 ? " of each room" : ""} will be charged.`
        }
      >
        {state?.success ? (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Button className="w-full" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form {...formProps} className="space-y-4">
            <input type="hidden" name="code" value={code} />
            <FormMessage state={state} />
            <Field label="Reason (optional)" htmlFor="reason">
              <Textarea id="reason" name="reason" placeholder="Let us know why — it helps us improve." />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Keep reservation
              </Button>
              <SubmitButton pending={pending} variant="danger" pendingText="Cancelling…">
                Confirm cancellation
              </SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
