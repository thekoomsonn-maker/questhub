import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { BannerView, type Banner } from "./site-banner-view";

/** Live banners for a placement (RLS only returns ones inside their date window). */
export async function SiteBanners({ placement, className }: { placement: "home" | "store"; className?: string }) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("site_banners")
    .select("id,title,body,link_url,link_label,tone")
    .eq("placement", placement)
    .eq("is_active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("sort_order")
    .limit(3);
  if (!data?.length) return null;
  return <div className={cn("flex flex-col gap-2", className)}>{data.map((b) => <BannerView key={b.id} banner={b as Banner} />)}</div>;
}
