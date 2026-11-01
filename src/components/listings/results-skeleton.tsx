import { Skeleton } from "@/components/ui/misc";
import { ListingGrid } from "./listing-card";

export function ResultsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]" aria-busy aria-label="Loading listings">
      <Skeleton className="hidden h-96 lg:block" />
      <div>
        <Skeleton className="mb-4 h-6 w-40" />
        <ListingGrid>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </ListingGrid>
      </div>
    </div>
  );
}
