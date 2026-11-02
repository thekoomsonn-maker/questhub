import Link from "next/link";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { OrderStatusBadge } from "./status";
import { vendorStatusLabel } from "./vendor-status";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Your orders" };

export default async function OrdersPage() {
  const viewer = await requireViewer("/orders");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id,order_number,kind,status,payment_status,total,currency,created_at,topup_type,topup_recipient,order_items(product_name,quantity)")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: shopOrders } = await supabase
    .from("vendor_orders")
    .select("id,order_number,status,subtotal,created_at,shop:shops(name),vendor_order_items(title,quantity)")
    .eq("buyer_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Your orders" description="Store purchases, airtime and data, and orders from shops." />
      {shopOrders?.length ? (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold">From shops</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {shopOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/shop/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-paper">
                  <div className="min-w-0">
                    <p className="font-medium">{o.order_number} · {o.shop?.name}</p>
                    <p className="truncate text-sm text-ink-soft">{o.vendor_order_items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}</p>
                    <p className="text-xs text-ink-faint">{formatDate(o.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-display font-bold tabular">{formatPrice(o.subtotal)}</span>
                    <Badge tone={o.status === "completed" ? "success" : ["declined", "cancelled"].includes(o.status) ? "danger" : "brand"}>{vendorStatusLabel[o.status]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data?.length ? <h2 className="mb-2 text-sm font-semibold">QuestHub Store and top-ups</h2> : null}
      {!data?.length && shopOrders?.length ? null : !data?.length ? (
        <EmptyState icon={<Package size={32} />} title="No orders yet" body="Things you buy from the QuestHub Store, and airtime or data top-ups, appear here." action={<ButtonLink href="/store">Go to the store</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {data.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-paper">
                <div className="min-w-0">
                  <p className="font-medium">{o.order_number}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {o.kind === "topup" ? `${o.topup_type === "data" ? "Data" : "Airtime"} for ${o.topup_recipient}` : o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}
                  </p>
                  <p className="text-xs text-ink-faint">{formatDate(o.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-display font-bold tabular">{formatPrice(o.total, o.currency)}</span>
                  <OrderStatusBadge status={o.status} paymentStatus={o.payment_status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
