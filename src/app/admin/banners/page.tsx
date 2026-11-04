import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "../ui";
import { BannerEditor } from "./banner-editor";

export const metadata: Metadata = { title: "Banners" };

export default async function BannersPage() {
  await requireStaff("commerce");
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_banners").select("*").order("placement").order("sort_order").order("created_at", { ascending: false });
  if (error) throw error;
  return (
    <>
      <AdminHeader
        title="Banners"
        description="Short announcements at the top of the home page or the store: a sale, free delivery, a new shop. Up to three show at once, in sort order."
      />
      <BannerEditor banners={data ?? []} />
    </>
  );
}
