import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { ShopLogo } from "@/components/shops/shop-card";
import { AdminHeader, Table, Tabs } from "../ui";
import { ShopAdminActions } from "./shop-admin-actions";

const STATUSES = ["pending", "active", "suspended"] as const;

export default async function AdminShops({ searchParams }: PageProps<"/admin/shops">) {
  await requireStaff("safety");
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? (sp.status as (typeof STATUSES)[number]) : "pending";
  const supabase = await createClient();
  const [{ data }, { data: all }] = await Promise.all([
    supabase.from("shops").select("*, owner:profiles!shops_owner_id_fkey(display_name), region:regions(name)").eq("status", status).order("created_at", { ascending: status === "pending" }),
    supabase.from("shops").select("status"),
  ]);
  return (
    <>
      <AdminHeader title="Shops" description="Check that a shop's name, logo and details are genuine before approving. Verify a business only after seeing its registration documents." />
      <Tabs base="/admin/shops" current={status} tabs={STATUSES.map((s) => ({ key: s, label: s === "pending" ? "To review" : s[0].toUpperCase() + s.slice(1), count: (all ?? []).filter((x) => x.status === s).length }))} />
      <Table head={["Shop", "Owner", "Payment", "Created", "Actions"]} empty={!data?.length}>
        {data?.map((s) => (
          <tr key={s.id}>
            <td className="px-3 py-3">
              <Link href={`/shop/${s.slug}`} target="_blank" className="flex items-center gap-3 hover:text-brand">
                <ShopLogo path={s.logo_path} name={s.name} size={40} />
                <span><span className="font-medium">{s.name}</span><span className="block text-xs text-ink-faint">/shop/{s.slug} · {[s.city, s.region?.name].filter(Boolean).join(", ")}</span></span>
              </Link>
              <div className="mt-1 flex gap-1">
                {s.is_verified ? <Badge tone="success">Verified</Badge> : null}
                {s.featured_until && new Date(s.featured_until) > new Date() ? <Badge tone="gold">Featured to {formatDate(s.featured_until)}</Badge> : null}
              </div>
              {s.status_reason ? <p className="mt-1 text-xs text-danger">{s.status_reason}</p> : null}
            </td>
            <td className="px-3 py-3"><Link href={`/admin/users?q=${encodeURIComponent(s.owner?.display_name ?? "")}`} className="hover:text-brand">{s.owner?.display_name}</Link></td>
            <td className="px-3 py-3 text-xs text-ink-soft">
              {s.accepts_pay_on_delivery ? <p>Pay on delivery</p> : null}
              {s.accepts_momo ? <p>MoMo {s.momo_number} ({s.momo_name})</p> : null}
            </td>
            <td className="px-3 py-3 text-ink-soft">{formatDate(s.created_at)}</td>
            <td className="px-3 py-3"><ShopAdminActions id={s.id} status={s.status} verified={s.is_verified} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
