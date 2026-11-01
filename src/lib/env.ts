/**
 * Central environment access. Public values are inlined by Next.js at build
 * time; secrets are only read on the server.
 */
function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in (see README).`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
  /** Server-only. Undefined in the browser. */
  get supabaseSecretKey() {
    return process.env.SUPABASE_SECRET_KEY;
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
  get checkoutEnabled() {
    return process.env.CHECKOUT_ENABLED === "true" && Boolean(process.env.PAYSTACK_SECRET_KEY);
  },
};
