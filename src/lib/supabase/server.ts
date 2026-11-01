import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { env } from "@/lib/env";

/** Supabase client bound to the visitor's session (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes sessions instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS: only for trusted server code such as
 * payment webhooks and maintenance jobs. Never import from client components.
 */
export function createServiceClient() {
  if (!env.supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }
  return createPlainClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
