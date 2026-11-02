import Link from "next/link";
import { ImageOff, MapPin, ShieldCheck } from "lucide-react";
import { conditionLabel, formatPrice, timeAgo } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import type { ListingSummary } from "@/lib/data/listings";
import { FavoriteButton } from "./favorite-button";

export function Price({ value, currency, negotiable, size = "md" }: { value: number | string | null; currency?: string; negotiable?: boolean; size?: "md" | "lg" }) {
  return (
    <p className={size === "lg" ? "font-display text-3xl font-bold tabular" : "font-display text-lg font-bold tabular"}>
      {formatPrice(value, currency)}
      {negotiable ? <span className="ml-1.5 align-middle font-sans text-xs font-medium text-ink-faint">Negotiable</span> : null}
    </p>
  );
}

export function LocationLabel({ city, region }: { city?: string | null; region?: string | null }) {
  const text = [city, region].filter(Boolean).join(", ");
  if (!text) return null;
  return (
    <span className="flex min-w-0 items-center gap-1 text-xs text-ink-faint">
      <MapPin size={12} className="shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function ListingCard({
  listing,
  favorited,
  signedIn,
  priority = false,
  buyOnline = false,
}: {
  listing: ListingSummary;
  favorited?: boolean;
  signedIn?: boolean;
  priority?: boolean;
  buyOnline?: boolean;
}) {
  const img = listingImageUrl(listing.cover_path);
  const promoted = listing.is_featured || listing.is_boosted;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative aspect-[4/3] bg-paper">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-faint">
            <ImageOff size={28} aria-hidden />
          </div>
        )}
        {promoted ? (
          <span className="absolute left-2 top-2 rounded-md bg-gold px-1.5 py-0.5 text-[11px] font-semibold text-ink" title="The seller paid to promote this listing">
            {listing.is_featured ? "Featured" : "Promoted"}
          </span>
        ) : null}
        {listing.status === "sold" ? (
          <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-xs font-semibold text-white">Sold</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Price value={listing.price} currency={listing.currency} />
        <h3 className="line-clamp-2 text-sm leading-snug text-ink">
          <Link href={`/listing/${listing.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            {listing.title}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <LocationLabel city={listing.city} region={listing.region_name} />
          <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(listing.published_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {conditionLabel[listing.condition] ? (
            <span className="text-[11px] font-medium text-ink-soft">{conditionLabel[listing.condition]}</span>
          ) : null}
          {buyOnline ? <span className="text-[11px] font-semibold text-brand">Order online</span> : null}
          {listing.seller_verified ? (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-success">
              <ShieldCheck size={12} aria-hidden /> Verified seller
            </span>
          ) : null}
        </div>
      </div>
      <div className="absolute right-2 top-2 z-10">
        <FavoriteButton listingId={listing.id} initial={Boolean(favorited)} signedIn={Boolean(signedIn)} compact />
      </div>
    </article>
  );
}

export function ListingGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}
