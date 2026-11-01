import Link from "next/link";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/auth";
import { getMyShop, isFeatured } from "@/lib/data/shops";
import { getRegions } from "@/lib/data/catalog";
import { avatarUrl } from "@/lib/images";
import { Badge, PageHeader } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = { title: "Your shop" };

export default async function ShopSettingsPage() {
  const viewer = await requireSeller();
  const [shop, regions] = await Promise.all([getMyShop(viewer.id), getRegions()]);
  const suggested = viewer.profile.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "my-shop";

  return (
    <>
      <PageHeader
        title={shop ? shop.name : "Open your shop"}
        description={shop ? undefined : "A shop gives your business its own page on QuestHub, with your logo, opening hours and all your products, and lets buyers order online and pay you directly."}
        actions={shop?.status === "active" ? <Link href={`/shop/${shop.slug}`} className="inline-flex h-10 items-center rounded-[var(--radius-field)] border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-paper">View shop</Link> : null}
      />
      {shop ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={shop.status === "active" ? "success" : shop.status === "pending" ? "gold" : "danger"}>
            {shop.status === "active" ? "Live" : shop.status === "pending" ? "Waiting for review" : "Suspended"}
          </Badge>
          {shop.is_verified ? <Badge tone="success">Verified business</Badge> : null}
          {isFeatured(shop) ? <Badge tone="gold">Featured</Badge> : null}
          {shop.status === "pending" ? <span className="text-sm text-ink-soft">We&apos;ll notify you when it&apos;s approved. You can keep editing meanwhile.</span> : null}
        </div>
      ) : null}
      {shop?.status === "suspended" ? <div className="mb-4"><FormMessage>Your shop was suspended{shop.status_reason ? `: ${shop.status_reason}` : ""}. Contact support to appeal.</FormMessage></div> : null}
      {shop?.status === "active" ? (
        <div className="mb-4"><FormMessage tone="info">To sell a product online, edit the listing and tick “Let buyers order this online” on the price step.</FormMessage></div>
      ) : null}
      <ShopForm
        userId={viewer.id}
        regions={regions}
        exists={Boolean(shop)}
        images={{ logo: avatarUrl(shop?.logo_path), banner: avatarUrl(shop?.banner_path) }}
        initial={{
          name: shop?.name ?? viewer.profile.display_name, slug: shop?.slug ?? suggested, tagline: shop?.tagline ?? "", about: shop?.about ?? viewer.profile.bio ?? "",
          phone: shop?.phone ?? "", whatsapp: shop?.whatsapp ?? "", regionId: String(shop?.region_id ?? viewer.profile.region_id ?? ""), city: shop?.city ?? viewer.profile.city ?? "",
          address: shop?.address ?? "", openingHours: shop?.opening_hours ?? "", deliveryInfo: shop?.delivery_info ?? "",
          acceptsPayOnDelivery: shop?.accepts_pay_on_delivery ?? true, acceptsMomo: shop?.accepts_momo ?? false, momoNumber: shop?.momo_number ?? "", momoName: shop?.momo_name ?? "",
        }}
      />
    </>
  );
}
