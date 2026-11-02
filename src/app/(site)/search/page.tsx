import type { Metadata } from "next";
import { Suspense } from "react";
import { parseSearchParams } from "@/lib/search-params";
import { ResultsView } from "@/components/listings/results-view";
import { ResultsSkeleton } from "@/components/listings/results-skeleton";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `${q} for sale in Ghana` : "Browse listings" };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const parsed = parseSearchParams(raw);
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold">
        {parsed.q ? `Results for “${parsed.q}”` : "All listings"}
      </h1>
      <Suspense key={JSON.stringify(raw)} fallback={<ResultsSkeleton />}>
        <ResultsView basePath="/search" raw={raw} parsed={parsed} />
      </Suspense>
    </div>
  );
}
