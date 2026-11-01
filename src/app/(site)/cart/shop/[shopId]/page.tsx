import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { getShopCart } from "@/lib/data/shops";
import { getRegions } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { ShopCheckoutForm } from "./shop-checkout-form";

export const metadata: Metadata = { title: "Order from shop" };

export default async function ShopCheckoutPage({ params }: PageProps<"/cart/shop/[shopId]">) {
  const { shopId } = await params;
  if (!z.uuid().safeParse(shopId).success) notFound();
  const viewer = await requireViewer(`/cart/shop/${shopId}`);
  const group = (await getShopCart(viewer.id)).find((g) => g.shop.id === shopId);
  if (!group?.items.length) redirect("/cart");
  const supabase = await createClient();
  const [regions, { data: shop }, { data: contacts }] = await Promise.all([
    getRegions(),
    supabase.from("shops").select("name,delivery_info,accepts_pay_on_delivery,accepts_momo,momo_name").eq("id", shopId).single(),
    supabase.from("profile_contacts").select("phone").eq("user_id", viewer.id).maybeSingle(),
  ]);
  if (!shop) notFound();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title={`Order from ${shop.name}`} description="The shop confirms your order, then delivers or arranges pickup. You pay the shop directly." />
      <ShopCheckoutForm
        shopId={shopId}
        shop={shop}
        regions={regions}
        items={group.items.map((i) => ({ title: i.listing.title, quantity: i.quantity, lineTotal: Number(i.listing.price) * i.quantity }))}
        subtotal={group.subtotal}
        defaults={{ name: viewer.profile.display_name, phone: contacts?.phone ?? "", regionId: viewer.profile.region_id, city: viewer.profile.city ?? "" }}
      />
    </div>
  );
}
