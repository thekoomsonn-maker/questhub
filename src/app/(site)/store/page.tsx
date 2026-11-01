import Link from "next/link";
import type { Metadata } from "next";
import { PackageSearch, Smartphone, Truck, ShieldCheck } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getCategoryTree } from "@/lib/data/catalog";
import { getProducts } from "@/lib/data/store";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/store/product-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "QuestHub Store", description: "Phones, accessories, appliances and more, sold and delivered by QuestHub. Pay with Mobile Money or card." };

export default async function StorePage({ searchParams }: PageProps<"/store">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const catSlug = typeof sp.category === "string" ? sp.category : "";
  const sort = (["featured", "price_asc", "price_desc", "newest"] as const).find((s) => s === sp.sort) ?? "featured";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  const [tree, viewer, { data: used }] = await Promise.all([
    getCategoryTree(),
    getViewer(),
    supabase.from("store_products").select("category_id").eq("is_active", true),
  ]);
  const usedIds = new Set((used ?? []).map((u) => u.category_id));
  const chips = tree.flatMap((r) => [r, ...r.children]).filter((c) => usedIds.has(c.id) || tree.find((t) => t.id === c.id)?.children.some((ch) => usedIds.has(ch.id)));
  const selected = chips.find((c) => c.slug === catSlug);
  const categoryIds = selected ? [selected.id, ...(tree.find((t) => t.id === selected.id)?.children.map((c) => c.id) ?? [])] : undefined;
  const result = await getProducts({ q: q || undefined, categoryIds, sort, page });

  const href = (changes: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const cur = { q, category: catSlug, sort: sort === "featured" ? "" : sort, page: "" };
    for (const [k, v] of Object.entries({ ...cur, ...changes })) if (v) p.set(k, String(v));
    return p.size ? `/store?${p}` : "/store";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <section className="mb-6 grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">QuestHub Store</h1>
          <p className="mt-1 text-ink-soft">Brand-new items sold and delivered by us. Pay with Mobile Money or card.</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            <li className="flex items-center gap-1.5"><Truck size={16} className="text-brand" aria-hidden /> Delivery across Ghana</li>
            <li className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-brand" aria-hidden /> Genuine products, with warranty where stated</li>
          </ul>
        </div>
        <ButtonLink href="/airtime" variant="secondary" size="lg"><Smartphone size={18} aria-hidden /> Buy airtime & data</ButtonLink>
      </section>

      <form method="get" action="/store" className="mb-4 flex gap-2" role="search">
        {catSlug ? <input type="hidden" name="category" value={catSlug} /> : null}
        <label htmlFor="store-q" className="sr-only">Search the store</label>
        <Input id="store-q" name="q" defaultValue={q} placeholder="Search the store" className="max-w-md" />
        <button className="rounded-[var(--radius-field)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover">Search</button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Store categories" className="flex flex-wrap gap-1.5">
          <Link href={href({ category: null })} aria-current={!selected ? "page" : undefined} className={cn("rounded-full border px-3 py-1.5 text-sm", !selected ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft hover:border-brand")}>All</Link>
          {chips.map((c) => (
            <Link key={c.id} href={href({ category: c.slug })} aria-current={selected?.id === c.id ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm", selected?.id === c.id ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft hover:border-brand")}>{c.name}</Link>
          ))}
        </nav>
        <nav aria-label="Sort" className="flex gap-3 text-sm">
          {([["featured", "Popular"], ["newest", "Newest"], ["price_asc", "Lowest price"], ["price_desc", "Highest price"]] as const).map(([k, l]) => (
            <Link key={k} href={href({ sort: k === "featured" ? null : k })} aria-current={sort === k ? "page" : undefined} className={sort === k ? "font-semibold text-brand" : "text-ink-soft hover:text-ink"}>{l}</Link>
          ))}
        </nav>
      </div>

      {result.items.length === 0 ? (
        <EmptyState icon={<PackageSearch size={32} />} title={q ? `Nothing in the store matches “${q}”` : "The store is being stocked"} body="Try another search, or browse ads from sellers across Ghana." action={<ButtonLink href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"} variant="secondary">Search all listings</ButtonLink>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {result.items.map((p) => <ProductCard key={p.id} product={p} signedIn={Boolean(viewer)} />)}
        </div>
      )}
      {result.pages > 1 ? (
        <nav className="mt-8 flex justify-center gap-2 text-sm" aria-label="Pagination">
          {page > 1 ? <Link className="rounded border border-line-strong bg-surface px-4 py-2" href={href({ page: page - 1 })}>Previous</Link> : null}
          <span className="px-3 py-2 text-ink-soft">Page {page} of {result.pages}</span>
          {page < result.pages ? <Link className="rounded border border-line-strong bg-surface px-4 py-2" href={href({ page: page + 1 })}>Next</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
