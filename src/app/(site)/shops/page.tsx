import type { Metadata } from "next";
import { Store } from "lucide-react";
import { listShops } from "@/lib/data/shops";
import { getRegions } from "@/lib/data/catalog";
import { ShopCard } from "@/components/shops/shop-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/field";

export const metadata: Metadata = { title: "Shops", description: "Browse shops and vendors across Ghana. Order online and pay the vendor directly." };

export default async function ShopsPage({ searchParams }: PageProps<"/shops">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const regionId = Number(sp.region) || undefined;
  const [shops, regions] = await Promise.all([listShops({ q: q || undefined, regionId }), getRegions()]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Shops</h1>
          <p className="mt-1 text-ink-soft">Businesses selling on QuestHub. Order online and pay the shop directly, on delivery or by MoMo.</p>
        </div>
        <ButtonLink href="/seller-dashboard/shop" variant="secondary">Open your own shop</ButtonLink>
      </div>
      <form method="get" className="mb-6 flex flex-wrap gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Search shops" aria-label="Search shops" className="max-w-xs" />
        <Select name="region" defaultValue={regionId ?? ""} aria-label="Region" className="w-48"><option value="">All of Ghana</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        <button className="rounded-[var(--radius-field)] bg-brand px-4 text-sm font-medium text-white">Search</button>
      </form>
      {shops.length === 0 ? (
        <EmptyState icon={<Store size={32} />} title="No shops found" body="Try another search, or open the first shop in your area." action={<ButtonLink href="/seller-dashboard/shop">Open a shop</ButtonLink>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{shops.map((s) => <ShopCard key={s.id} shop={s} />)}</div>
      )}
    </div>
  );
}
