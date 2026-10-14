"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";

type State = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

/** A button that runs a bound server action and reports the outcome as a toast. */
export function ActionButton({
  action,
  confirm,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & { action: () => Promise<State>; confirm?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/** A dialog wrapping a form that posts to a server action; closes and toasts on success. */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  submitLabel = "Save",
  submitVariant,
  children,
  className,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (state: State, formData: FormData) => Promise<State>;
  submitLabel?: string;
  submitVariant?: React.ComponentProps<typeof Button>["variant"];
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, formProps } = useActionForm(async (prev: State, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.success && !result.error) {
      toast.success(result.success);
      setOpen(false);
      return null;
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description} className={className}>
        <form {...formProps} className="space-y-4">
          <FormMessage state={state?.error ? { error: state.error } : null} />
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={pending} variant={submitVariant}>
              {submitLabel}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Inline form (not in a dialog) with toast feedback. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const { state, formProps } = useActionForm(async (prev: State, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.success) toast.success(result.success);
    return result;
  }, null);
  return (
    <form
      onSubmit={(e) => {
        formProps.onSubmit(e);
        if (resetOnSuccess) {
          const form = e.currentTarget;
          setTimeout(() => form.reset(), 0);
        }
      }}
      className={className}
    >
      <FormMessage state={state?.error ? { error: state.error } : null} />
      {children}
    </form>
  );
}
