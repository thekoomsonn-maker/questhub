"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import type { Json } from "@/lib/supabase/database.types";
import { updateSetting } from "../actions";

const labels: Record<string, string> = {
  require_listing_review: "Review every listing before it goes live",
  prohibited_terms: "Prohibited words (one per line)",
  max_active_listings_per_user: "Max active listings per seller",
  max_new_listings_per_day: "Max new listings per seller per day",
  max_images_per_listing: "Max photos per listing",
  listing_expiry_days: "Days before a listing expires",
  max_messages_per_minute: "Messages per user per minute",
  max_new_conversations_per_hour: "New chats per buyer per hour",
  promotions_test_mode: "Promotion test mode",
  checkout_enabled: "Online checkout",
  crypto_usd_rate: "Crypto exchange rate (GH₵ per US$1)",
  delivery_fee_default: "Default delivery fee (GH₵)",
  delivery_fees: "Delivery fee per region (JSON)",
  free_delivery_over: "Free delivery from (GH₵)",
  airtime_min: "Smallest airtime top-up (GH₵)",
  airtime_max: "Largest airtime top-up (GH₵)",
  shops_require_approval: "Review new shops before they go live",
};

export function SettingRow({ setting }: { setting: { key: string; value: Json; description: string | null } }) {
  const router = useRouter();
  const initial = Array.isArray(setting.value) ? (setting.value as string[]).join("\n") : String(setting.value);
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const id = `setting-${setting.key}`;
  return (
    <Card className="p-4">
      <form className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateSetting(setting.key, value);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        });
      }}>
        <div className="sm:max-w-md">
          <label htmlFor={id} className="text-sm font-medium">{labels[setting.key] ?? setting.key}</label>
          {setting.description ? <p className="text-xs text-ink-soft">{setting.description}</p> : null}
        </div>
        <div className="flex items-start gap-2">
          {typeof setting.value === "boolean" ? (
            <Select id={id} value={value} onChange={(e) => setValue(e.target.value)} className="h-10 w-28" disabled={setting.key === "checkout_enabled"}>
              <option value="true">On</option><option value="false">Off</option>
            </Select>
          ) : Array.isArray(setting.value) ? (
            <Textarea id={id} value={value} onChange={(e) => setValue(e.target.value)} className="w-64" rows={5} />
          ) : (
            <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} className={typeof setting.value === "object" ? "h-10 w-64 font-mono text-xs" : "h-10 w-28"} inputMode={typeof setting.value === "number" ? "decimal" : undefined} />
          )}
          <Button type="submit" size="md" variant="secondary" pending={pending} disabled={value === initial || setting.key === "checkout_enabled"}>Save</Button>
        </div>
      </form>
      {setting.key === "checkout_enabled" ? <p className="mt-2 text-xs text-ink-faint">Controlled by server environment variables so it can&apos;t be switched on without payment keys.</p> : null}
    </Card>
  );
}
