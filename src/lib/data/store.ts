import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";

export const productSelect = "id,slug,name,brand,price,compare_at_price,stock,is_featured,warranty,category_id,images:store_product_images(storage_path,sort_order)";

export type StoreProduct = {
  id: string; slug: string; name: string; brand: string | null; price: number; compare_at_price: number | null;
  stock: number; is_featured: boolean; warranty: string | null; category_id: string | null;
  images: { storage_path: string; sort_order: number }[];
};

export function coverOf(p: { images: { storage_path: string; sort_order: number }[] }) {
  return [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;
}

export async function getProducts({ q, categoryIds, sort = "featured", page = 1, pageSize = 24, featuredOnly = false }: {
  q?: string; categoryIds?: string[]; sort?: "featured" | "price_asc" | "price_desc" | "newest"; page?: number; pageSize?: number; featuredOnly?: boolean;
}) {
  const supabase = await createClient();
  let query = supabase.from("store_products").select(productSelect, { count: "exact" }).eq("is_active", true);
  if (q) query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  if (categoryIds?.length) query = query.in("category_id", categoryIds);
  if (featuredOnly) query = query.eq("is_featured", true);
  query =
    sort === "price_asc" ? query.order("price") :
    sort === "price_desc" ? query.order("price", { ascending: false }) :
    sort === "newest" ? query.order("created_at", { ascending: false }) :
    query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { items: (data ?? []) as unknown as StoreProduct[], total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / pageSize)), page };
}

export const getProductBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_products")
    .select(`${productSelect},description,sku,category:categories(name,slug)`)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  data.images.sort((a, b) => a.sort_order - b.sort_order);
  return data;
});

export const getCart = cache(async () => {
  const viewer = await getViewer();
  if (!viewer) return { items: [], subtotal: 0, count: 0 };
  const supabase = await createClient();
  const { data } = await supabase
    .from("cart_items")
    .select(`quantity,product:store_products(${productSelect},is_active)`)
    .eq("user_id", viewer.id)
    .order("added_at");
  const items = (data ?? []).filter((i) => i.product) as unknown as { quantity: number; product: StoreProduct & { is_active: boolean } }[];
  const subtotal = items.reduce((n, i) => n + Number(i.product.price) * i.quantity, 0);
  return { items, subtotal, count: items.reduce((n, i) => n + i.quantity, 0) };
});

export function discountPercent(price: number, compareAt: number | null) {
  if (!compareAt || compareAt <= price) return null;
  return Math.round((1 - price / compareAt) * 100);
}
