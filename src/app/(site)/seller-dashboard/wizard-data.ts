import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree, getRegions } from "@/lib/data/catalog";

export async function getWizardData() {
  const supabase = await createClient();
  const [categories, regions, attrs] = await Promise.all([
    getCategoryTree(),
    getRegions(),
    supabase.from("category_attributes").select("id,category_id,key,label,type,options,unit,is_required,sort_order").order("sort_order"),
  ]);
  return { categories, regions, attributes: attrs.data ?? [] };
}
