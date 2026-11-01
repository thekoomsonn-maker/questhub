import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { site } from "@/config/site";

type SearchRow = Database["public"]["Functions"]["search_listings"]["Returns"][number];
/** Card-level listing data. Generated RPC types mark every column non-null; these can be null. */
export type ListingSummary = Omit<SearchRow, "city" | "region_name" | "cover_path" | "published_at" | "price"> & {
  city: string | null;
  region_name: string | null;
  cover_path: string | null;
  published_at: string | null;
  price: number | null;
};
export type SortOption = "relevance" | "newest" | "price_asc" | "price_desc";
export type Condition = Database["public"]["Enums"]["listing_condition"];

export type SearchParams = {
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  regionId?: number;
  condition?: Condition;
  attrs?: Record<string, string>;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
};

export async function searchListings(params: SearchParams) {
  const supabase = await createClient();
  const pageSize = params.pageSize ?? site.limits.pageSize;
  const page = Math.max(1, params.page ?? 1);
  const { data, error } = await supabase.rpc("search_listings", {
    p_query: params.q || undefined,
    p_category: params.categoryId,
    p_min_price: params.minPrice,
    p_max_price: params.maxPrice,
    p_region: params.regionId,
    p_condition: params.condition,
    p_attrs: params.attrs ?? {},
    p_sort: params.sort ?? (params.q ? "relevance" : "newest"),
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  const total = data[0]?.total_count ?? 0;
  return { items: data, total: Number(total), page, pageSize, pages: Math.max(1, Math.ceil(Number(total) / pageSize)) };
}

/** Listings with an active "featured" promotion, for the home page. */
export async function getFeaturedListings(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_listings", {
    p_limit: limit,
    p_sort: "newest",
    p_featured_only: true,
  });
  return data ?? [];
}

export const getListingBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      `*,
       category:categories!inner(id,name,slug,parent:parent_id(id,name,slug)),
       region:regions(id,name),
       images:listing_images(id,storage_path,sort_order),
       values:listing_attribute_values(value_text,value_number,value_bool,attribute:category_attributes(key,label,type,unit,sort_order))`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!listing) return null;

  const { data: seller } = await supabase
    .from("profiles")
    .select("id,display_name,username,avatar_path,is_verified,created_at,city,region:regions(name)")
    .eq("id", listing.seller_id)
    .maybeSingle();

  listing.images.sort((a, b) => a.sort_order - b.sort_order);
  // Self-referencing join: PostgREST returns the parent as an object, types say array.
  const rawParent = listing.category.parent as unknown;
  const parent = (Array.isArray(rawParent) ? rawParent[0] : rawParent) as { id: string; name: string; slug: string } | null;
  listing.values.sort((a, b) => (a.attribute?.sort_order ?? 0) - (b.attribute?.sort_order ?? 0));
  return { ...listing, category: { ...listing.category, parent }, seller };
});

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

/** Seller stats that are reliable: active listings, sold count, rating from verified sales. */
export async function getSellerStats(sellerId: string) {
  const supabase = await createClient();
  const [active, sold, rating] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", sellerId).eq("status", "published"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", sellerId).eq("status", "sold"),
    supabase.rpc("seller_rating", { p_seller: sellerId }),
  ]);
  const r = rating.data?.[0];
  return {
    activeCount: active.count ?? 0,
    soldCount: sold.count ?? 0,
    rating: r && r.total > 0 ? { average: Number(r.average), total: r.total } : null,
  };
}
