import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { AdminHeader, Table } from "../ui";

export const metadata: Metadata = { title: "Vendor performance" };

const periods = [7, 30, 90] as const;
const statusTone = { active: "success", pending: "gold", suspended: "danger" } as const;

function minutes(n: number | null) {
  if (n === null) return "No data";
  if (n < 60) return `${n} min`;
  if (n < 60 * 24) return `${Math.round(n / 60)} h`;
  return `${Math.round(n / 1440)} days`;
}

export default async function VendorsPage({ searchParams }: PageProps<"/admin/vendors">) {
  await requireStaff("commerce");
  const sp = await searchParams;
  const days = periods.find((p) => String(p) === sp.days) ?? 30;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_vendor_report", { p_days: days });
  if (error) throw error;
  const rows = data ?? [];
  const totalSales = rows.reduce((a, r) => a + Number(r.sales), 0);
  const totalOrders = rows.reduce((a, r) => a + Number(r.orders), 0);
  const slow = rows.filter((r) => r.median_confirm_minutes !== null && Number(r.median_confirm_minutes) > 240).length;
  const open = rows.reduce((a, r) => a + Number(r.open_orders), 0);

  return (
    <>
      <AdminHeader
        title="Vendor performance"
        description="Sales are the value of completed vendor orders. Vendors are paid directly, so this money never passes through QuestHub."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex gap-1 rounded-full border border-line bg-surface p-1" aria-label="Period">
              {periods.map((p) => (
                <Link key={p} href={p === 30 ? "/admin/vendors" : `/admin/vendors?days=${p}`} aria-current={p === days ? "page" : undefined}
                  className={cn("rounded-full px-3 py-1 text-sm", p === days ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}>
                  {p} days
                </Link>
              ))}
            </nav>
            <a href={`/admin/export/vendors?days=${days}`} className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm hover:border-ink">Download CSV</a>
          </div>
        }
      />

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 sm:grid-cols-4">
        <div><dt className="text-sm text-ink-soft">Vendor sales</dt><dd className="font-display text-2xl font-bold tabular">{formatPrice(totalSales)}</dd></div>
        <div><dt className="text-sm text-ink-soft">Vendor orders</dt><dd className="font-display text-2xl font-bold tabular">{totalOrders}</dd></div>
        <div><dt className="text-sm text-ink-soft">Orders still open</dt><dd className="font-display text-2xl font-bold tabular">{open}</dd></div>
        <div><dt className="text-sm text-ink-soft">Shops slow to confirm</dt><dd className="font-display text-2xl font-bold tabular">{slow}</dd><p className="text-xs text-ink-faint">Typical confirmation over 4 hours</p></div>
      </dl>

      <Table head={["Shop", "Orders", "Completed", "Declined or cancelled", "Sales", "Completion", "Time to confirm", "Live ads"]} empty={rows.length === 0}>
        {rows.map((r) => (
          <tr key={r.shop_id} className="border-t border-line align-top">
            <td className="px-3 py-3">
              <Link href={`/shop/${r.slug}`} className="font-medium hover:text-brand">{r.name}</Link>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={statusTone[r.status]}>{r.status === "active" ? "Live" : r.status === "pending" ? "Awaiting approval" : "Suspended"}</Badge>
                {r.is_verified ? <Badge tone="success">Verified</Badge> : null}
                {r.featured_until && new Date(r.featured_until) > new Date() ? <Badge tone="gold">Featured</Badge> : null}
              </div>
            </td>
            <td className="px-3 py-3 tabular">{r.orders}{Number(r.open_orders) ? <span className="block text-xs text-ink-faint">{r.open_orders} open</span> : null}</td>
            <td className="px-3 py-3 tabular">{r.completed}</td>
            <td className={cn("px-3 py-3 tabular", Number(r.declined) + Number(r.cancelled) > Number(r.completed) && Number(r.orders) >= 3 && "text-danger")}>{Number(r.declined) + Number(r.cancelled)}</td>
            <td className="px-3 py-3 tabular">{formatPrice(r.sales)}</td>
            <td className="px-3 py-3 tabular">{r.completion_rate === null ? "No data" : `${r.completion_rate}%`}</td>
            <td className={cn("px-3 py-3 tabular", r.median_confirm_minutes !== null && Number(r.median_confirm_minutes) > 240 && "text-danger")}>{minutes(r.median_confirm_minutes === null ? null : Number(r.median_confirm_minutes))}</td>
            <td className="px-3 py-3 tabular">{r.live_listings}<span className="block text-xs text-ink-faint">{r.orderable_listings} sold online</span></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
