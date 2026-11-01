import Link from "next/link";
import { SearchX } from "lucide-react";
import { getRegions, type CategoryAttribute } from "@/lib/data/catalog";
import { searchListings } from "@/lib/data/listings";
import { getFavoriteIds } from "@/lib/data/viewer";
import { getViewer } from "@/lib/auth";
import { pluralize } from "@/lib/format";
import { searchHref, type ParsedSearch } from "@/lib/search-params";
import { ListingCard, ListingGrid } from "./listing-card";
import { SearchFilters, SortSelect } from "./search-filters";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

type Raw = Record<string, string | string[] | undefined>;

export async function ResultsView({
  basePath,
  raw,
  parsed,
  categoryId,
  attributes = [],
}: {
  basePath: string;
  raw: Raw;
  parsed: ParsedSearch;
  categoryId?: string;
  attributes?: CategoryAttribute[];
}) {
  const [result, regions, viewer, favs] = await Promise.all([
    searchListings({ ...parsed, categoryId }),
    getRegions(),
    getViewer(),
    getFavoriteIds(),
  ]);

  const values: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) values[k] = Array.isArray(v) ? v[0] : v;
  const hasActive = Boolean(
    parsed.minPrice !== undefined || parsed.maxPrice !== undefined || parsed.regionId || parsed.condition || Object.keys(parsed.attrs).length,
  );

  const sorts = parsed.q ? ["relevance", "newest", "price_asc", "price_desc"] : ["newest", "price_asc", "price_desc"];
  const hrefFor = Object.fromEntries(sorts.map((s) => [s, searchHref(basePath, raw, { sort: s })]));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <SearchFilters key={JSON.stringify(values)} action={basePath} values={values} regions={regions} attributes={attributes} hasActive={hasActive} />
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft" aria-live="polite">
            {pluralize(result.total, "listing")}
            {parsed.q ? <> for <strong className="text-ink">&ldquo;{parsed.q}&rdquo;</strong></> : null}
          </p>
          <SortSelect value={parsed.sort} hrefFor={hrefFor} />
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={<SearchX size={32} />}
            title="No listings match"
            body={hasActive ? "Try removing a filter or widening the price range." : "Try a different word, or browse a category."}
            action={
              hasActive ? (
                <ButtonLink href={parsed.q ? `${basePath}?q=${encodeURIComponent(parsed.q)}` : basePath} variant="secondary">Clear filters</ButtonLink>
              ) : (
                <ButtonLink href="/categories" variant="secondary">Browse categories</ButtonLink>
              )
            }
          />
        ) : (
          <ListingGrid>
            {result.items.map((l, i) => (
              <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={Boolean(viewer)} priority={i < 4} />
            ))}
          </ListingGrid>
        )}

        {result.pages > 1 ? (
          <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
            {result.page > 1 ? (
              <Link className="rounded-[var(--radius-field)] border border-line-strong bg-surface px-4 py-2 text-sm hover:bg-paper" href={searchHref(basePath, raw, { page: result.page - 1 })} rel="prev">
                Previous
              </Link>
            ) : null}
            <span className="px-3 text-sm text-ink-soft tabular">
              Page {result.page} of {result.pages}
            </span>
            {result.page < result.pages ? (
              <Link className="rounded-[var(--radius-field)] border border-line-strong bg-surface px-4 py-2 text-sm hover:bg-paper" href={searchHref(basePath, raw, { page: result.page + 1 })} rel="next">
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
