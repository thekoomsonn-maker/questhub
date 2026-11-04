import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { staffCan, staffLevelOf } from "@/lib/staff";
import { formatPrice } from "@/lib/format";
import { Card } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./ui";
import { RevenueChart } from "./revenue-chart";

type Stats = {
  total_users: number; new_users_7d: number; active_sellers: number; published_listings: number;
  pending_review: number; sold_listings: number; open_reports: number; active_promotions: number;
};

type Sales = {
  days: number;
  totals: { store_revenue: number; topup_revenue: number; orders: number; goods_orders: number; topup_orders: number; avg_order: number; customers: number };
  previous: { store_revenue: number; topup_revenue: number; orders: number };
  test_orders: number;
  promotion_revenue: number;
  by_day: { day: string; store: number; topups: number; orders: number }[];
  status_counts: Record<string, number>;
  needs_attention: { to_ship: number; refunds_due: number; low_stock: number };
  top_products: { name: string; units: number; revenue: number }[];
  topups_by_network: { network: string; type: string; orders: number; revenue: number; delivered: number }[];
  marketplace: { new_users: number; new_listings: number; published_now: number; sold: number; conversations: number; new_shops: number; active_shops: number };
};

const periods = [7, 30, 90] as const;
const networkLabel: Record<string, string> = { mtn: "MTN", telecel: "Telecel", airteltigo: "AirtelTigo" };
const statusLabel: Record<string, string> = {
  pending_payment: "Awaiting payment", paid: "Paid", processing: "Packing", shipped: "Shipped", delivered: "Delivered",
  cancelled: "Cancelled", failed: "Failed", refund_due: "Refund due", refunded: "Refunded",
};

function change(now: number, before: number) {
  if (!before) return now ? "New this period" : null;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "Up" : "Down"} ${Math.abs(pct)}% on the previous period`;
}

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const viewer = await requireAdmin();
  const level = staffLevelOf(viewer.profile)!;
  const days = periods.find((p) => String(p) === sp.days) ?? 30;
  const supabase = await createClient();
  const canInsights = staffCan(level, "insights");

  const [{ data: statsData, error }, sales] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    canInsights ? supabase.rpc("admin_sales_report", { p_days: days }) : Promise.resolve({ data: null, error: null }),
  ]);
  if (error) throw error;
  if (sales.error) throw sales.error;
  const s = statsData as unknown as Stats;
  const r = sales.data as unknown as Sales | null;

  const queue = [
    { label: "Listings to review", value: s.pending_review, href: "/admin/listings?status=pending_review", show: staffCan(level, "safety") },
    { label: "Reports to handle", value: s.open_reports, href: "/admin/reports", show: staffCan(level, "safety") },
    { label: "Orders to ship", value: r?.needs_attention.to_ship ?? 0, href: "/admin/orders", show: staffCan(level, "commerce") },
    { label: "Refunds due", value: r?.needs_attention.refunds_due ?? 0, href: "/admin/orders?status=attention", show: staffCan(level, "commerce") },
    { label: "Products low on stock", value: r?.needs_attention.low_stock ?? 0, href: "/admin/products", show: staffCan(level, "commerce") },
  ].filter((q) => q.show);

  return (
    <>
      <AdminHeader
        title="Dashboard"
        description={canInsights ? "Revenue counts verified payments only. Test payments are never included." : "Your work queue and a snapshot of the marketplace."}
        actions={canInsights ? (
          <nav className="flex gap-1 rounded-full border border-line bg-surface p-1" aria-label="Period">
            {periods.map((p) => (
              <Link key={p} href={p === 30 ? "/admin" : `/admin?days=${p}`} aria-current={p === days ? "page" : undefined}
                className={cn("rounded-full px-3 py-1 text-sm", p === days ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}>
                {p} days
              </Link>
            ))}
          </nav>
        ) : null}
      />

      {sp.denied ? <div className="mb-4"><FormMessage tone="info">Your staff role doesn&apos;t include that page.</FormMessage></div> : null}

      <section aria-label="Needs attention" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {queue.map((q) => (
          <Link key={q.label} href={q.href}
            className={cn("flex items-center justify-between rounded-[var(--radius-card)] border px-4 py-3 hover:border-ink",
              q.value > 0 ? "border-gold bg-gold-tint" : "border-line bg-surface")}>
            <span className="text-sm font-medium">{q.label}</span>
            <span className="font-display text-2xl font-bold tabular">{q.value}</span>
          </Link>
        ))}
      </section>

      {r ? (
        <>
          <section aria-label="Sales" className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 lg:grid-cols-5">
            <Kpi label="Store revenue" value={formatPrice(r.totals.store_revenue)} note={change(Number(r.totals.store_revenue), Number(r.previous.store_revenue))} />
            <Kpi label="Top-up revenue" value={formatPrice(r.totals.topup_revenue)} note={change(Number(r.totals.topup_revenue), Number(r.previous.topup_revenue))} />
            <Kpi label="Paid orders" value={r.totals.orders.toLocaleString()} note={`${r.totals.customers} ${r.totals.customers === 1 ? "customer" : "customers"}`} />
            <Kpi label="Average store order" value={formatPrice(r.totals.avg_order)} note={`${r.totals.goods_orders} store orders`} />
            <Kpi label="Promotion revenue" value={formatPrice(r.promotion_revenue)} note="Boosts and featured ads" />
          </section>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_320px]">
            <Card className="p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-bold">Revenue by day</h2>
                {r.test_orders ? <span className="text-xs text-ink-faint">{r.test_orders} test {r.test_orders === 1 ? "payment" : "payments"} left out</span> : null}
              </div>
              <RevenueChart days={r.by_day} />
            </Card>
            <Card className="p-5">
              <h2 className="font-display text-lg font-bold">Orders by status</h2>
              <p className="text-xs text-ink-faint">Placed in the last {r.days} days</p>
              <StatusList counts={r.status_counts} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-display text-lg font-bold">Best-selling products</h2>
              {r.top_products.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No paid store orders in this period.</p> : (
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs text-ink-soft"><tr><th className="pb-2 font-medium">Product</th><th className="pb-2 text-right font-medium">Units</th><th className="pb-2 text-right font-medium">Revenue</th></tr></thead>
                  <tbody>
                    {r.top_products.map((p) => (
                      <tr key={p.name} className="border-t border-line">
                        <td className="max-w-0 truncate py-2 pr-3">{p.name}</td>
                        <td className="py-2 text-right tabular">{p.units}</td>
                        <td className="py-2 text-right tabular">{formatPrice(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="font-display text-lg font-bold">Airtime and data</h2>
              {r.topups_by_network.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No paid top-ups in this period.</p> : (
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs text-ink-soft"><tr><th className="pb-2 font-medium">Network</th><th className="pb-2 text-right font-medium">Orders</th><th className="pb-2 text-right font-medium">Delivered</th><th className="pb-2 text-right font-medium">Revenue</th></tr></thead>
                  <tbody>
                    {r.topups_by_network.map((t) => (
                      <tr key={t.network + t.type} className="border-t border-line">
                        <td className="py-2">{networkLabel[t.network] ?? t.network} {t.type}</td>
                        <td className="py-2 text-right tabular">{t.orders}</td>
                        <td className={cn("py-2 text-right tabular", t.delivered < t.orders && "text-danger")}>{Math.round((t.delivered / Math.max(1, t.orders)) * 100)}%</td>
                        <td className="py-2 text-right tabular">{formatPrice(t.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <section aria-label="Marketplace activity" className="mt-6">
            <h2 className="font-display text-lg font-bold">Marketplace, last {r.days} days</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 xl:grid-cols-7">
              <Stat label="New users" value={r.marketplace.new_users} />
              <Stat label="New listings" value={r.marketplace.new_listings} />
              <Stat label="Live listings now" value={r.marketplace.published_now} />
              <Stat label="Marked sold" value={r.marketplace.sold} />
              <Stat label="Buyer chats started" value={r.marketplace.conversations} />
              <Stat label="New shops" value={r.marketplace.new_shops} />
              <Stat label="Live shops" value={r.marketplace.active_shops} />
            </dl>
          </section>
        </>
      ) : (
        <section aria-label="Marketplace" className="mt-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
            <Stat label="Users" value={s.total_users} />
            <Stat label="New this week" value={s.new_users_7d} />
            <Stat label="Active sellers" value={s.active_sellers} />
            <Stat label="Live listings" value={s.published_listings} />
            <Stat label="Marked sold" value={s.sold_listings} />
            <Stat label="Active promotions" value={s.active_promotions} />
          </dl>
        </section>
      )}
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-[1.6rem] font-bold leading-tight tabular">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-ink-faint">{note}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-display text-xl font-bold tabular">{Number(value).toLocaleString()}</dd>
    </div>
  );
}

function StatusList({ counts }: { counts: Record<string, number> }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  if (!rows.length) return <p className="mt-3 text-sm text-ink-soft">No orders in this period.</p>;
  return (
    <ul className="mt-3 space-y-2.5">
      {rows.map(([k, n]) => (
        <li key={k} className="text-sm">
          <div className="flex justify-between"><span>{statusLabel[k] ?? k}</span><span className="tabular">{n}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-paper"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
