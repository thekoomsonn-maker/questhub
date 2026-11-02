import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAttributesForCategory, getCategoryBySlug } from "@/lib/data/catalog";
import { parseSearchParams } from "@/lib/search-params";
import { ResultsView } from "@/components/listings/results-view";
import { ResultsSkeleton } from "@/components/listings/results-skeleton";

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const found = await getCategoryBySlug((await params).slug);
  return found ? { title: `${found.category.name} for sale in Ghana` } : {};
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const found = await getCategoryBySlug(slug);
  if (!found) notFound();
  const { category, parent, children } = found;
  const attributes = await getAttributesForCategory(category.id);
  const parsed = parseSearchParams(raw, attributes.filter((a) => a.is_filterable).map((a) => a.key));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-ink-faint">
        <Link href="/categories" className="hover:text-brand">Categories</Link>
        {parent ? <> / <Link href={`/categories/${parent.slug}`} className="hover:text-brand">{parent.name}</Link></> : null}
      </nav>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{category.name}</h1>
      {children.length ? (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Subcategories">
          {children.map((c) => (
            <li key={c.id}>
              <Link href={`/categories/${c.slug}`} className="inline-block rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm hover:border-brand hover:text-brand">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6">
        <Suspense key={JSON.stringify(raw)} fallback={<ResultsSkeleton />}>
          <ResultsView basePath={`/categories/${slug}`} raw={raw} parsed={parsed} categoryId={category.id} attributes={attributes} />
        </Suspense>
      </div>
    </div>
  );
}
