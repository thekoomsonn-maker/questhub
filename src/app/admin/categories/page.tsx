import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "../ui";
import { CategoryEditor } from "./category-editor";

export default async function AdminCategories() {
  await requireStaff("commerce");
  const supabase = await createClient();
  const [{ data: cats }, { data: attrs }, { data: listings }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("category_attributes").select("category_id"),
    supabase.from("listings").select("category_id").eq("status", "published"),
  ]);
  const roots = (cats ?? []).filter((c) => !c.parent_id);
  const count = (arr: { category_id: string }[] | null, id: string) => (arr ?? []).filter((a) => a.category_id === id).length;
  const rows = roots.flatMap((r) => [r, ...(cats ?? []).filter((c) => c.parent_id === r.id)]).map((c) => ({
    ...c, attributeCount: count(attrs, c.id), liveCount: count(listings, c.id),
  }));
  return (
    <>
      <AdminHeader title="Categories" description="Lower sort numbers appear first. Deactivated categories disappear from navigation and stop accepting new listings." />
      <CategoryEditor rows={rows} parents={roots.map((r) => ({ id: r.id, name: r.name }))} />
    </>
  );
}
