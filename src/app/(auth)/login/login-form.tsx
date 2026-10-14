"use client";

import { useRef } from "react";
import { KeyRound } from "lucide-react";
import { Field, FormMessage, Input, SubmitButton, useActionForm } from "@/components/ui/form";
import { login } from "../actions";

type Demo = { accounts: { email: string; role: string; description: string }[]; password: string } | null;

export function LoginForm({ next, demo }: { next?: string; demo: Demo }) {
  const { state, pending, formProps } = useActionForm(login, null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fill(email: string) {
    if (!emailRef.current || !passwordRef.current || !demo) return;
    emailRef.current.value = email;
    passwordRef.current.value = demo.password;
    emailRef.current.form?.requestSubmit();
  }

  return (
    <>
      <form {...formProps} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <FormMessage state={state} />
        <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password}>
          <Input ref={passwordRef} id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton pending={pending} className="w-full" size="lg" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      {demo && (
        <div className="mt-8 rounded-xl border border-gold/30 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <KeyRound className="size-4 text-gold" /> Demo access
          </div>
          <p className="mt-1 text-xs text-muted-foreground">One click signs you in with a seeded demo account.</p>
          <div className="mt-3 grid gap-2">
            {demo.accounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => fill(a.email)}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-gold/50 hover:bg-gold-soft/40"
              >
                <span>
                  <span className="font-medium text-foreground">{a.role}</span>
                  <span className="block text-xs text-muted-foreground">{a.description}</span>
                </span>
                <span className="text-xs text-muted-foreground">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
