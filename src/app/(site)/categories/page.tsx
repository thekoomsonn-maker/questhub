import Link from "next/link";
import type { Metadata } from "next";
import { getCategoryTree } from "@/lib/data/catalog";
import { CategoryIcon } from "@/components/listings/category-icon";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "All categories" };

export default async function CategoriesPage() {
  const tree = await getCategoryTree();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader title="All categories" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <section key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <Link href={`/categories/${c.slug}`} className="flex items-center gap-3 hover:text-brand">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-tint text-brand">
                <CategoryIcon name={c.icon} size={20} />
              </span>
              <h2 className="font-display text-lg font-bold">{c.name}</h2>
            </Link>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {c.children.map((s) => (
                <li key={s.id}>
                  <Link href={`/categories/${s.slug}`} className="inline-block rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-brand hover:text-brand">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
