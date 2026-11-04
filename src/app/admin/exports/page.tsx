import Link from "next/link";
import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { staffCan, type StaffArea } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { AdminHeader } from "../ui";

export const metadata: Metadata = { title: "Exports" };

const periods = [7, 30, 90, 365] as const;
const exports: { kind: string; title: string; body: string; area: StaffArea }[] = [
  { kind: "orders", title: "Store and top-up orders", body: "Every order with its items, customer, delivery details and payment status.", area: "insights" },
  { kind: "vendor-orders", title: "Vendor orders", body: "Orders customers placed with vendor shops, with payment method and status.", area: "insights" },
  { kind: "vendors", title: "Vendor performance", body: "One row per shop: orders, completion rate, sales and time to confirm.", area: "commerce" },
  { kind: "listings", title: "Listings", body: "Marketplace ads created in the period, with views, contacts and status.", area: "safety" },
  { kind: "payments", title: "Payments", body: "Every payment attempt with provider references, for reconciling with Paystack.", area: "owner" },
  { kind: "users", title: "Users", body: "Names, emails and account status of people who joined in the period. Contains personal data.", area: "owner" },
];

export default async function ExportsPage({ searchParams }: PageProps<"/admin/exports">) {
  const { level } = await requireStaff("insights");
  const sp = await searchParams;
  const days = periods.find((p) => String(p) === sp.days) ?? 30;
  const visible = exports.filter((e) => staffCan(level, e.area));

  return (
    <>
      <AdminHeader
        title="Exports"
        description="Download spreadsheets (CSV) for accounting and reporting. Each download is recorded in the audit log."
        actions={
          <nav className="flex gap-1 rounded-full border border-line bg-surface p-1" aria-label="Period">
            {periods.map((p) => (
              <Link key={p} href={p === 30 ? "/admin/exports" : `/admin/exports?days=${p}`} aria-current={p === days ? "page" : undefined}
                className={cn("rounded-full px-3 py-1 text-sm", p === days ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}>
                {p === 365 ? "1 year" : `${p} days`}
              </Link>
            ))}
          </nav>
        }
      />
      <ul className="divide-y divide-line border-y border-line">
        {visible.map((e) => (
          <li key={e.kind} className="flex flex-wrap items-center gap-4 py-4">
            <FileSpreadsheet size={22} className="shrink-0 text-ink-faint" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-ink-soft">{e.body}</p>
            </div>
            <a href={`/admin/export/${e.kind}?days=${days}`} className="rounded-[var(--radius-field)] border border-line-strong bg-surface px-4 py-2 text-sm font-medium hover:border-ink">
              Download {e.title.toLowerCase()}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-faint">Up to 20,000 rows per file. Opens in Excel, Google Sheets and Numbers.</p>
    </>
  );
}
