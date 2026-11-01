import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Category = Tables<"categories">;
export type CategoryNode = Category & { children: Category[] };
export type Region = Tables<"regions">;
export type CategoryAttribute = Tables<"category_attributes">;

/** Active categories as a two-level tree, ordered for navigation. */
export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  const roots = data.filter((c) => !c.parent_id).map((c) => ({ ...c, children: [] as Category[] }));
  const byId = new Map(roots.map((r) => [r.id, r]));
  for (const c of data) if (c.parent_id) byId.get(c.parent_id)?.children.push(c);
  return roots;
});

export const getRegions = cache(async (): Promise<Region[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("regions").select("*").order("id");
  if (error) throw error;
  return data;
});

export async function getCategoryBySlug(slug: string) {
  const tree = await getCategoryTree();
  for (const root of tree) {
    if (root.slug === slug) return { category: root as Category, parent: null, children: root.children };
    const child = root.children.find((c) => c.slug === slug);
    if (child) return { category: child, parent: root as Category, children: [] as Category[] };
  }
  return null;
}

/** Attributes for a category including those inherited from its parent. */
export async function getAttributesForCategory(categoryId: string): Promise<CategoryAttribute[]> {
  const supabase = await createClient();
  const { data: cat } = await supabase.from("categories").select("id,parent_id").eq("id", categoryId).single();
  if (!cat) return [];
  const ids = [cat.id, cat.parent_id].filter(Boolean) as string[];
  const { data } = await supabase
    .from("category_attributes")
    .select("*")
    .in("category_id", ids)
    .order("sort_order");
  return data ?? [];
}
