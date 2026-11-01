"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSafeRedirect } from "@/lib/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import type { ActionResult } from "@/lib/utils";
import {
  fieldErrors,
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  signInSchema,
} from "@/lib/validation";

export async function signIn(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    log.info("auth.sign_in_failed", { code: error.code });
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Confirm your email first. We sent you a link when you registered." };
    }
    return { ok: false, error: "That email and password don't match an account." };
  }
  const next = form.get("next")?.toString();
  revalidatePath("/", "layout");
  redirect(isSafeRedirect(next) ? next : "/");
}

export async function register(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${env.siteUrl}/auth/confirm?next=/account/profile`,
    },
  });
  if (error) {
    log.info("auth.sign_up_failed", { code: error.code });
    if (error.code === "user_already_exists") return { ok: false, error: "An account with that email already exists. Sign in instead." };
    if (error.code === "weak_password") return { ok: false, error: "Choose a stronger password." };
    return { ok: false, error: "We couldn't create your account. Try again." };
  }
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/account/profile?welcome=1");
  }
  return { ok: true, message: `We sent a confirmation link to ${parsed.data.email}. Open it to finish creating your account.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error) log.warn("auth.reset_request_failed", { code: error.code });
  // Same message either way so the form can't be used to discover accounts.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: error.code === "same_password" ? "Choose a different password from your current one." : "Your reset link has expired. Request a new one." };
  }
  redirect("/account?password=updated");
}
