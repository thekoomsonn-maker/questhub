import Link from "next/link";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Listing analytics" };

/** Last 30 calendar days as YYYY-MM-DD, oldest first. */
function last30Days() {
  const today = Date.now();
  return Array.from({ length: 30 }, (_, i) => new Date(today - (29 - i) * 864e5).toISOString().slice(0, 10));
}

export default async function AnalyticsPage() {
  const viewer = await requireSeller();
  const supabase = await createClient();
  const days = last30Days();
  const since = days[0];
  const { data: listings } = await supabase.from("listings").select("id,slug,title,status,view_count,contact_count").eq("seller_id", viewer.id).order("view_count", { ascending: false });
  const ids = (listings ?? []).map((l) => l.id);
  const { data: stats } = ids.length
    ? await supabase.from("listing_daily_stats").select("day,views,contacts").in("listing_id", ids).gte("day", since)
    : { data: [] };

  const byDay = new Map(days.map((d) => [d, { views: 0, contacts: 0 }]));
  for (const s of stats ?? []) {
    const d = byDay.get(s.day);
    if (d) { d.views += s.views; d.contacts += s.contacts; }
  }
  const series = days.map((d) => ({ day: d, ...byDay.get(d)! }));
  const max = Math.max(1, ...series.map((s) => s.views));
  const totalViews = series.reduce((n, s) => n + s.views, 0);
  const totalContacts = series.reduce((n, s) => n + s.contacts, 0);
  const fmt = new Intl.DateTimeFormat(site.market.locale, { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader title="Analytics" description="Views and contacts over the last 30 days. Your own visits aren't counted." />
      {!listings?.length ? (
        <EmptyState title="Nothing to measure yet" body="Once your listings are live you'll see how many people view and contact you." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4"><p className="text-sm text-ink-soft">Views (30 days)</p><p className="font-display text-3xl font-semibold tabular">{totalViews.toLocaleString()}</p></Card>
            <Card className="p-4"><p className="text-sm text-ink-soft">Contacts (30 days)</p><p className="font-display text-3xl font-semibold tabular">{totalContacts.toLocaleString()}</p><p className="text-xs text-ink-faint">New chats and phone reveals</p></Card>
          </div>
          <Card className="mt-4 p-4">
            <h2 className="mb-3 text-sm font-medium">Daily views</h2>
            <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Daily views over 30 days, peak ${max}`}>
              {series.map((s) => (
                <div key={s.day} className="group relative flex-1">
                  <div className="w-full rounded-t-[3px] bg-brand" style={{ height: `${Math.max(2, (s.views / max) * 152)}px`, opacity: s.views ? 1 : 0.15 }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[11px] text-white group-hover:block">
                    {fmt.format(new Date(s.day))}: {s.views} views, {s.contacts} contacts
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-ink-faint"><span>{fmt.format(new Date(days[0]))}</span><span>Today</span></div>
          </Card>
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-ink-soft"><tr><th className="p-3 font-medium">Listing</th><th className="p-3 text-right font-medium">Views</th><th className="p-3 text-right font-medium">Contacts</th><th className="p-3 text-right font-medium">Contact rate</th></tr></thead>
              <tbody className="divide-y divide-line">
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td className="max-w-xs truncate p-3"><Link href={`/listing/${l.slug}`} className="hover:text-brand">{l.title}</Link></td>
                    <td className="p-3 text-right tabular">{l.view_count}</td>
                    <td className="p-3 text-right tabular">{l.contact_count}</td>
                    <td className="p-3 text-right tabular">{l.view_count ? `${Math.round((l.contact_count / l.view_count) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
