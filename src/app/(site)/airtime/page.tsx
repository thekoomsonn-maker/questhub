import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { paymentsMode } from "@/lib/payments/config";
import { FormMessage } from "@/components/ui/field";
import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Buy airtime and data", description: "Top up MTN, Telecel and AirtelTigo airtime and data bundles. Pay with Mobile Money or card." };

export default async function AirtimePage() {
  const supabase = await createClient();
  const [viewer, { data: bundles }, { data: limits }, contacts] = await Promise.all([
    getViewer(),
    supabase.from("topup_bundles").select("id,network,name,data_mb,validity,price").eq("is_active", true).order("sort_order").order("price"),
    supabase.from("platform_settings").select("key,value").in("key", ["airtime_min", "airtime_max"]),
    getViewer().then(async (v) => (v ? (await supabase.from("profile_contacts").select("phone").eq("user_id", v.id).maybeSingle()).data : null)),
  ]);
  const l = Object.fromEntries((limits ?? []).map((r) => [r.key, Number(r.value)]));
  const mode = paymentsMode();

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Airtime & data</h1>
      <p className="mt-1 text-ink-soft">Top up any MTN, Telecel or AirtelTigo number in Ghana. Pay with Mobile Money or card; it arrives in seconds.</p>
      <div className="mt-4 flex flex-col gap-2">
        {mode === "off" ? <FormMessage>Top-ups aren&apos;t switched on yet. Please check back soon.</FormMessage> : null}
        {mode === "test" ? <FormMessage tone="info">Test mode: payments are simulated and no airtime is actually sent. Numbers ending in 000 simulate a failed top-up.</FormMessage> : null}
      </div>
      <TopupForm
        bundles={(bundles ?? []).map((b) => ({ ...b, price: Number(b.price) }))}
        min={l.airtime_min ?? 1}
        max={l.airtime_max ?? 500}
        signedIn={Boolean(viewer)}
        defaultNumber={contacts?.phone ?? ""}
        disabled={mode === "off"}
      />
    </div>
  );
}
