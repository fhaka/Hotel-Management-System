"use client";

import { startTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const fieldBase =
  "w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/70 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:bg-muted aria-invalid:border-danger";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-10 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%236b6f7b%22%20stroke-width%3D%222%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string | string[];
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {message ? <p className="text-xs text-danger">{message}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return <input type="checkbox" className={cn("size-4 cursor-pointer rounded border-input accent-[#0f1a2e]", className)} {...props} />;
}

/**
 * Like useActionState, but submits via onSubmit so React does not reset the form fields
 * after the action runs (keeps user input when the server returns validation errors).
 */
export function useActionForm<S>(fn: (state: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(fn, initial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, pending, formProps: { onSubmit } };
}

export function SubmitButton({
  children,
  pendingText,
  pending: pendingProp,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending && <Loader2 className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state?: { error?: string; success?: string } | null }) {
  if (!state?.error && !state?.success) return null;
  return (
    <div
      role={state.error ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        state.error ? "border-danger/20 bg-danger-soft text-danger" : "border-success/20 bg-success-soft text-success",
      )}
    >
      {state.error ?? state.success}
    </div>
  );
}
