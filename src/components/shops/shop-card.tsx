import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { avatarUrl } from "@/lib/images";

export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_path: string | null;
  banner_path: string | null;
  city: string | null;
  is_verified: boolean;
  featured_until: string | null;
  region: { name: string } | null;
};

export function ShopLogo({ path, name, size = 56 }: { path: string | null; name: string; size?: number }) {
  const url = avatarUrl(path);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[12px] border border-line bg-surface object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-[12px] border border-line bg-brand-tint font-display font-bold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ShopCard({ shop }: { shop: ShopSummary }) {
  const featured = shop.featured_until && new Date(shop.featured_until) > new Date();
  const banner = avatarUrl(shop.banner_path);
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface hover:border-line-strong">
      <div className="flex h-20 flex-col justify-end bg-brand">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="kente-strip-thin" aria-hidden />
        )}
      </div>
      {featured ? (
        <span className="absolute left-2 top-2 rounded-md bg-gold px-1.5 py-0.5 text-[11px] font-semibold text-ink" title="Paid placement">
          Featured
        </span>
      ) : null}
      <div className="-mt-7 flex flex-col gap-1 p-3">
        <ShopLogo path={shop.logo_path} name={shop.name} />
        <h3 className="mt-1 flex items-center gap-1 font-display font-bold">
          <Link href={`/shop/${shop.slug}`} className="after:absolute after:inset-0">
            {shop.name}
          </Link>
          {shop.is_verified ? <BadgeCheck size={16} className="shrink-0 text-success" aria-label="Verified business" /> : null}
        </h3>
        {shop.tagline ? <p className="line-clamp-2 text-sm text-ink-soft">{shop.tagline}</p> : null}
        {shop.city || shop.region ? (
          <p className="flex items-center gap-1 text-xs text-ink-faint">
            <MapPin size={12} aria-hidden />
            {[shop.city, shop.region?.name].filter(Boolean).join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
