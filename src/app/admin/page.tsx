import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { site } from "@/config/site";
import { Card } from "@/components/ui/misc";
import { AdminHeader } from "./ui";

type Stats = {
  total_users: number; new_users_7d: number; active_sellers: number; suspended_users: number; published_listings: number;
  pending_review: number; sold_listings: number; open_reports: number; active_promotions: number; promotion_revenue_paid: number;
  listings_by_category: { name: string; count: number }[]; signups_by_day: { day: string; count: number }[];
};

export default async function AdminOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) throw error;
  const s = data as unknown as Stats;
  const maxCat = Math.max(1, ...s.listings_by_category.map((c) => c.count));
  const maxDay = Math.max(1, ...s.signups_by_day.map((d) => d.count));
  const fmt = new Intl.DateTimeFormat(site.market.locale, { day: "numeric", month: "short" });

  const queue = [
    { label: "Listings awaiting review", value: s.pending_review, href: "/admin/listings?status=pending_review", urgent: s.pending_review > 0 },
    { label: "Reports to handle", value: s.open_reports, href: "/admin/reports", urgent: s.open_reports > 0 },
  ];
  const tiles = [
    { label: "Users", value: s.total_users, sub: `+${s.new_users_7d} this week` },
    { label: "Active sellers", value: s.active_sellers, sub: "with a live listing" },
    { label: "Live listings", value: s.published_listings },
    { label: "Marked sold", value: s.sold_listings },
    { label: "Active promotions", value: s.active_promotions },
    { label: "Promotion revenue", value: formatPrice(s.promotion_revenue_paid), sub: "verified payments only" },
  ];

  return (
    <>
      <AdminHeader title="Overview" />
      <div className="grid gap-3 sm:grid-cols-2">
        {queue.map((q) => (
          <Link key={q.label} href={q.href}>
            <Card className={`flex items-center justify-between p-5 hover:border-ink ${q.urgent ? "border-gold bg-gold-tint" : ""}`}>
              <span className="font-medium">{q.label}</span>
              <span className="font-display text-3xl font-bold tabular">{q.value}</span>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-ink-soft">{t.label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular">{t.value}</p>
            {t.sub ? <p className="text-[11px] text-ink-faint">{t.sub}</p> : null}
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Sign-ups, last 14 days</h2>
          <div className="flex h-36 items-end gap-1" role="img" aria-label="Daily sign-ups">
            {s.signups_by_day.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${fmt.format(new Date(d.day))}: ${d.count}`}>
                <span className="text-[10px] tabular text-ink-faint">{d.count || ""}</span>
                <div className="w-full rounded-t-[3px] bg-brand" style={{ height: `${Math.max(2, (d.count / maxDay) * 112)}px`, opacity: d.count ? 1 : 0.15 }} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Live listings by category</h2>
          {s.listings_by_category.length === 0 ? <p className="text-sm text-ink-soft">No live listings.</p> : (
            <ul className="space-y-2">
              {s.listings_by_category.map((c) => (
                <li key={c.name} className="grid grid-cols-[10rem_1fr_2rem] items-center gap-3 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="h-2 rounded-full bg-brand" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                  <span className="text-right tabular">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
