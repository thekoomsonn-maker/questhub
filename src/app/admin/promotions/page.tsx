import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge, Card } from "@/components/ui/misc";
import { AdminHeader, Table } from "../ui";
import { PlanRow, PromotionActions } from "./promotion-controls";

export default async function AdminPromotions() {
  const supabase = await createClient();
  const [{ data: plans }, { data: promos }, { data: testMode }] = await Promise.all([
    supabase.from("promotion_plans").select("*").order("sort_order"),
    supabase.from("promotions").select("id,kind,amount,currency,duration_days,status,payment_status,starts_at,ends_at,created_at,listing:listings(title,slug),seller:profiles!promotions_seller_id_fkey(display_name)").order("created_at", { ascending: false }).limit(100),
    supabase.from("platform_settings").select("value").eq("key", "promotions_test_mode").single(),
  ]);
  const isTest = testMode?.value === true;
  return (
    <>
      <AdminHeader title="Promotions" description={isTest ? "Test mode is on: you can activate requests without payment. They're recorded as test, never as paid." : "Promotions activate only after a verified payment."} />
      <h2 className="mb-2 text-sm font-semibold">Plans</h2>
      <Card className="mb-6 divide-y divide-line">
        {plans?.map((p) => <PlanRow key={p.id} plan={{ id: p.id, name: p.name, price: Number(p.price), durationDays: p.duration_days, isActive: p.is_active }} />)}
      </Card>
      <h2 className="mb-2 text-sm font-semibold">Requests and active promotions</h2>
      <Table head={["Listing", "Seller", "Plan", "Status", "Actions"]} empty={!promos?.length}>
        {promos?.map((p) => (
          <tr key={p.id}>
            <td className="px-3 py-3">{p.listing ? <Link href={`/listing/${p.listing.slug}`} target="_blank" className="hover:text-brand">{p.listing.title}</Link> : "Deleted"}</td>
            <td className="px-3 py-3 text-ink-soft">{p.seller?.display_name}</td>
            <td className="px-3 py-3 text-ink-soft">{p.kind} · {p.duration_days}d · {formatPrice(p.amount, p.currency)}</td>
            <td className="px-3 py-3">
              <Badge tone={p.status === "active" ? "success" : p.status === "pending_payment" ? "brand" : "neutral"}>{p.status.replace("_", " ")}</Badge>
              {p.payment_status === "test" ? <div className="mt-1"><Badge tone="gold">test, unpaid</Badge></div> : <div className="mt-1 text-xs text-ink-faint">payment: {p.payment_status}</div>}
              {p.ends_at ? <p className="text-xs text-ink-faint">until {formatDate(p.ends_at)}</p> : null}
            </td>
            <td className="px-3 py-3"><PromotionActions id={p.id} status={p.status} testMode={isTest} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
