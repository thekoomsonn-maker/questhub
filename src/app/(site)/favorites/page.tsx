import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { RemoveFavorite } from "./remove-favorite";

export const metadata: Metadata = { title: "Saved items" };

export default async function FavoritesPage() {
  const viewer = await requireViewer("/favorites");
  const supabase = await createClient();
  const { data: favs } = await supabase
    .from("favorites")
    .select("listing_id,created_at,listing:listings(id,slug,title,price,currency,is_negotiable,condition,city,published_at,status,seller_id,region:regions(name),images:listing_images(storage_path,sort_order))")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false });

  const available = (favs ?? []).filter((f) => f.listing && ["published", "sold"].includes(f.listing.status));
  const gone = (favs ?? []).filter((f) => !f.listing || !["published", "sold"].includes(f.listing.status));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader title="Saved items" description="Listings you've saved. We'll show you if one sells or is taken down." />
      {!favs?.length ? (
        <EmptyState icon={<Heart size={32} />} title="Nothing saved yet" body="Tap the heart on any listing to keep it here for later." action={<ButtonLink href="/search">Browse listings</ButtonLink>} />
      ) : (
        <>
          <ListingGrid>
            {available.map(({ listing: l }) => (
              <ListingCard
                key={l!.id}
                favorited
                signedIn
                listing={{
                  id: l!.id, slug: l!.slug, title: l!.title, price: l!.price, currency: l!.currency, is_negotiable: l!.is_negotiable,
                  condition: l!.condition, city: l!.city, region_name: l!.region?.name ?? null, published_at: l!.published_at,
                  status: l!.status, seller_id: l!.seller_id, seller_verified: false,
                  cover_path: [...l!.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
                  is_boosted: false, is_featured: false, total_count: 0,
                }}
              />
            ))}
          </ListingGrid>
          {gone.length ? (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-medium text-ink-soft">No longer available</h2>
              <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
                {gone.map((f) => (
                  <li key={f.listing_id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span className="text-ink-soft">{f.listing?.title ?? "A listing that was removed"}{f.listing ? " — paused or expired" : ""}</span>
                    <RemoveFavorite listingId={f.listing_id} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
