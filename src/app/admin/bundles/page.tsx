import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "../ui";
import { BundleEditor } from "./bundle-editor";

export default async function AdminBundles() {
  const supabase = await createClient();
  const { data } = await supabase.from("topup_bundles").select("*").order("network").order("sort_order").order("price");
  return (
    <>
      <AdminHeader
        title="Data bundles"
        description="Bundles customers can buy. The bundle code must match the code in your top-up provider (Hubtel) dashboard exactly; the price is what customers pay, so it sets your margin."
      />
      <BundleEditor bundles={(data ?? []).map((b) => ({ id: b.id, network: b.network, name: b.name, validity: b.validity ?? "", price: String(b.price), providerCode: b.provider_code, sortOrder: String(b.sort_order), isActive: b.is_active }))} />
    </>
  );
}
