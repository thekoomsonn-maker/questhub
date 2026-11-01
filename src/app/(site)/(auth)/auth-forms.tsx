"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/utils";
import { register, requestPasswordReset, signIn, updatePassword } from "./actions";

function err(state: ActionResult | null, key: string) {
  return state && !state.ok ? state.fieldErrors?.[key] : undefined;
}

function Status({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <FormMessage tone="success">{state.message}</FormMessage>
  ) : state.fieldErrors ? null : (
    <FormMessage>{state.error}</FormMessage>
  );
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {linkError ? <FormMessage>That link has expired or was already used. Sign in or request a new one.</FormMessage> : null}
      <Status state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field id="email" label="Email" error={err(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(err(state, "email"))} />
      </Field>
      <Field id="password" label="Password" error={err(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(err(state, "password"))} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm text-brand hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" pending={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, null);
  if (state?.ok) return <FormMessage tone="success">{state.message}</FormMessage>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Status state={state} />
      <Field id="displayName" label="Your name" hint="Shown on your listings. You can use a business name." error={err(state, "displayName")}>
        <Input id="displayName" name="displayName" autoComplete="name" required aria-invalid={Boolean(err(state, "displayName"))} />
      </Field>
      <Field id="email" label="Email" error={err(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(err(state, "email"))} />
      </Field>
      <Field id="password" label="Password" hint="At least 8 characters, with a letter and a number." error={err(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={Boolean(err(state, "password"))} />
      </Field>
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-brand underline">terms of use</Link> and{" "}
            <Link href="/privacy" className="text-brand underline">privacy policy</Link>.
          </span>
        </label>
        {err(state, "acceptTerms") ? <p role="alert" className="text-xs font-medium text-danger">{err(state, "acceptTerms")![0]}</p> : null}
      </div>
      <Button type="submit" size="lg" pending={pending}>
        Create account
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.ok) return <FormMessage tone="success">{state.message}</FormMessage>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Status state={state} />
      <Field id="email" label="Email" error={err(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" pending={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Status state={state} />
      <Field id="password" label="New password" hint="At least 8 characters, with a letter and a number." error={err(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field id="confirm" label="Repeat new password" error={err(state, "confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" pending={pending}>
        Save new password
      </Button>
    </form>
  );
}
