import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "../ui";
import { SettingRow } from "./setting-row";

export default async function AdminSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("key,value,description,updated_at").order("key");
  return (
    <>
      <AdminHeader title="Settings" description="Moderation rules and limits. Changes apply immediately and are logged." />
      <div className="flex flex-col gap-3">
        {data?.map((s) => <SettingRow key={s.key} setting={{ key: s.key, value: s.value, description: s.description }} />)}
      </div>
    </>
  );
}
