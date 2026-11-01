import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Shop = Tables<"shops">;

export const getMyShop = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select("*").eq("owner_id", userId).maybeSingle();
  return data;
});

export const getShopBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select("*, region:regions(name)").eq("slug", slug.toLowerCase()).maybeSingle();
  return data;
});

export function isFeatured(shop: Pick<Shop, "featured_until">) {
  return Boolean(shop.featured_until && new Date(shop.featured_until) > new Date());
}

/** Active shops, featured first. */
export async function listShops({ q, regionId, limit = 48, featuredOnly = false }: { q?: string; regionId?: number; limit?: number; featuredOnly?: boolean }) {
  const supabase = await createClient();
  let query = supabase.from("shops").select("id,slug,name,tagline,logo_path,banner_path,city,is_verified,featured_until,region:regions(name)").eq("status", "active");
  if (q) query = query.or(`name.ilike.%${q.replace(/[%_,()\\]/g, "")}%,tagline.ilike.%${q.replace(/[%_,()\\]/g, "")}%`);
  if (regionId) query = query.eq("region_id", regionId);
  if (featuredOnly) query = query.gt("featured_until", new Date().toISOString());
  const { data } = await query.order("featured_until", { ascending: false, nullsFirst: false }).order("is_verified", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getShopCart(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_cart_items")
    .select("quantity,listing:listings(id,slug,title,price,currency,quantity,status,orderable,seller_id,images:listing_images(storage_path,sort_order))")
    .eq("user_id", userId)
    .order("added_at");
  const lines = (data ?? []).filter((l) => l.listing);
  const sellerIds = [...new Set(lines.map((l) => l.listing!.seller_id))];
  const { data: shops } = sellerIds.length
    ? await supabase.from("shops").select("id,slug,name,owner_id,logo_path,accepts_pay_on_delivery,accepts_momo").in("owner_id", sellerIds)
    : { data: [] };
  return (shops ?? []).map((shop) => {
    const items = lines.filter((l) => l.listing!.seller_id === shop.owner_id).map((l) => ({ quantity: l.quantity, listing: l.listing! }));
    return { shop, items, subtotal: items.reduce((n, i) => n + Number(i.listing.price ?? 0) * i.quantity, 0) };
  });
}
