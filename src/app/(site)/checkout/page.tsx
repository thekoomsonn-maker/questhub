import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getCart } from "@/lib/data/store";
import { getRegions } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { paymentsMode } from "@/lib/payments/config";
import { paymentOptions } from "@/lib/payments/options";
import { FormMessage } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/misc";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const viewer = await requireViewer("/checkout");
  const cart = await getCart();
  if (cart.items.length === 0) redirect("/cart");
  const supabase = await createClient();
  const [regions, { data: contacts }, { data: settings }] = await Promise.all([
    getRegions(),
    supabase.from("profile_contacts").select("phone").eq("user_id", viewer.id).maybeSingle(),
    supabase.from("platform_settings").select("key,value").in("key", ["delivery_fees", "delivery_fee_default", "free_delivery_over"]),
  ]);
  const s = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]));
  const mode = paymentsMode();
  const options = await paymentOptions();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Checkout" />
      {mode === "off" ? <div className="mb-4"><FormMessage>Online payment isn&apos;t switched on yet, so orders can&apos;t be placed. Please check back soon.</FormMessage></div> : null}
      {mode === "test" ? <div className="mb-4"><FormMessage tone="info">Test mode: you&apos;ll see a practice payment page. No money is taken and nothing will be delivered.</FormMessage></div> : null}
      <CheckoutForm
        regions={regions}
        items={cart.items.map((i) => ({ name: `${i.product.brand ? `${i.product.brand} ` : ""}${i.product.name}`, quantity: i.quantity, lineTotal: Number(i.product.price) * i.quantity }))}
        subtotal={cart.subtotal}
        fees={{ byRegion: (s.delivery_fees ?? {}) as Record<string, number>, fallback: Number(s.delivery_fee_default ?? 35), freeOver: Number(s.free_delivery_over ?? 0) }}
        defaults={{ name: viewer.profile.display_name, phone: contacts?.phone ?? "", regionId: viewer.profile.region_id, city: viewer.profile.city ?? "" }}
        disabled={mode === "off"}
        paymentOptions={options}
      />
    </div>
  );
}
