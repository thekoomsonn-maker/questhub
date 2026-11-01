import Link from "next/link";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/auth";
import { getMyShop } from "@/lib/data/shops";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { vendorStatusLabel } from "../../orders/vendor-status";
import { VendorOrderActions } from "./vendor-order-actions";

export const metadata: Metadata = { title: "Shop orders" };

const TABS = [
  { key: "", label: "New", statuses: ["requested"] },
  { key: "active", label: "In progress", statuses: ["confirmed", "out_for_delivery", "ready_for_pickup"] },
  { key: "done", label: "Completed", statuses: ["completed"] },
  { key: "closed", label: "Declined / cancelled", statuses: ["declined", "cancelled"] },
] as const;

export default async function VendorOrdersPage({ searchParams }: PageProps<"/seller-dashboard/orders">) {
  const viewer = await requireSeller();
  const shop = await getMyShop(viewer.id);
  if (!shop) {
    return <EmptyState title="Open your shop to receive orders" body="Once your shop is live, buyers can order your products online and pay you directly." action={<ButtonLink href="/seller-dashboard/shop">Open your shop</ButtonLink>} />;
  }
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === (sp.status ?? "")) ?? TABS[0];
  const supabase = await createClient();
  const [{ data }, { data: all }] = await Promise.all([
    supabase.from("vendor_orders")
      .select("*, region:regions(name), vendor_order_items(id,title,quantity,unit_price,line_total,listing:listings(slug))")
      .eq("shop_id", shop.id).in("status", [...tab.statuses]).order("created_at", { ascending: tab.key === "" }).limit(100),
    supabase.from("vendor_orders").select("status").eq("shop_id", shop.id),
  ]);

  return (
    <>
      <PageHeader title="Shop orders" description="Buyers pay you directly: on delivery, or by MoMo to your number. Always check your MoMo wallet before handing over goods." />
      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filter orders">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key ? `/seller-dashboard/orders?status=${t.key}` : "/seller-dashboard/orders"} aria-current={t === tab ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-sm", t === tab ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft")}>
            {t.label} <span className="tabular opacity-70">{(all ?? []).filter((o) => (t.statuses as readonly string[]).includes(o.status)).length}</span>
          </Link>
        ))}
      </nav>
      {!data?.length ? (
        <EmptyState title={tab.key === "" ? "No new orders" : "Nothing here"} body="New orders appear here and in your notifications." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((o) => (
            <li key={o.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{o.order_number} · <span className="font-display tabular">{formatPrice(o.subtotal)}</span></p>
                  <p className="text-xs text-ink-faint">{formatDate(o.created_at)} {formatTime(o.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={o.status === "requested" ? "gold" : o.status === "completed" ? "success" : ["declined", "cancelled"].includes(o.status) ? "danger" : "brand"}>{vendorStatusLabel[o.status]}</Badge>
                  <Badge>{o.payment_method === "pay_on_delivery" ? "Pay on delivery" : "MoMo to you"}</Badge>
                  {o.payment_method === "momo_to_vendor" && o.buyer_marked_paid && !o.vendor_confirmed_payment ? <Badge tone="gold">Buyer says paid: check wallet</Badge> : null}
                  {o.vendor_confirmed_payment ? <Badge tone="success">Payment received</Badge> : null}
                </div>
              </div>
              <ul className="mt-3 text-sm">
                {o.vendor_order_items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>{i.quantity} × {i.listing ? <Link href={`/listing/${i.listing.slug}`} className="hover:text-brand">{i.title}</Link> : i.title}</span>
                    <span className="tabular">{formatPrice(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
                <p><span className="font-medium text-ink">{o.buyer_name}</span> · <a href={`tel:${o.buyer_phone}`} className="text-brand">{o.buyer_phone}</a></p>
                {o.delivery_address || o.delivery_city ? <p>{[o.delivery_address, o.delivery_city, o.region?.name].filter(Boolean).join(", ")}</p> : null}
                {o.buyer_note ? <p className="mt-1">Note: {o.buyer_note}</p> : null}
              </div>
              <VendorOrderActions id={o.id} status={o.status} momo={o.payment_method === "momo_to_vendor"} paymentConfirmed={o.vendor_confirmed_payment} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
