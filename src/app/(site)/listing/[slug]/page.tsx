import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Eye, ShieldCheck, Star, TriangleAlert } from "lucide-react";
import { getListingBySlug, getSellerStats, searchListings } from "@/lib/data/listings";
import { getFavoriteIds } from "@/lib/data/viewer";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { conditionLabel, formatDate, formatPrice, statusLabel, timeAgo } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { site } from "@/config/site";
import { ImageGallery } from "@/components/listings/image-gallery";
import { ContactActions, ShareButton } from "@/components/listings/listing-actions";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { ListingCard, LocationLabel, Price } from "@/components/listings/listing-card";
import { ReportButton } from "@/components/report-button";
import { UserAvatar } from "@/components/user-avatar";
import { AddToShopCart } from "@/components/shops/add-to-shop-cart";
import { ShopLogo } from "@/components/shops/shop-card";
import { Badge, Card } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";

export async function generateMetadata({ params }: PageProps<"/listing/[slug]">): Promise<Metadata> {
  const listing = await getListingBySlug((await params).slug);
  if (!listing) return { title: "Listing not found" };
  const description = `${formatPrice(listing.price, listing.currency)} · ${[listing.city, listing.region?.name].filter(Boolean).join(", ")}. ${listing.description.slice(0, 140)}`;
  const image = listingImageUrl(listing.images[0]?.storage_path);
  const isPublic = listing.status === "published" || listing.status === "sold";
  return {
    title: listing.title,
    description,
    robots: isPublic ? undefined : { index: false },
    alternates: { canonical: `/listing/${listing.slug}` },
    openGraph: { title: listing.title, description, images: image ? [{ url: image }] : undefined, type: "website" },
    twitter: { card: image ? "summary_large_image" : "summary", title: listing.title, description },
  };
}

function attrValue(v: { value_text: string | null; value_number: number | null; value_bool: boolean | null; attribute: { key: string; unit: string | null } | null }) {
  if (v.value_bool !== null) return v.value_bool ? "Yes" : "No";
  if (v.value_number !== null && v.attribute?.key === "year") return String(v.value_number);
  if (v.value_number !== null) return `${Number(v.value_number).toLocaleString(site.market.locale)}${v.attribute?.unit ? ` ${v.attribute.unit}` : ""}`;
  return v.value_text ?? "";
}

export default async function ListingPage({ params }: PageProps<"/listing/[slug]">) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const supabase = await createClient();
  const [viewer, favs, stats, sharesPhone, similar, { data: shop }] = await Promise.all([
    getViewer(),
    getFavoriteIds(),
    getSellerStats(listing.seller_id),
    supabase.rpc("seller_shares_phone", { p_seller: listing.seller_id }),
    searchListings({ categoryId: listing.category_id, pageSize: 5, sort: "newest" }),
    supabase.from("shops").select("slug,name,logo_path,is_verified,accepts_pay_on_delivery,accepts_momo,status").eq("owner_id", listing.seller_id).eq("status", "active").maybeSingle(),
  ]);
  const canOrderOnline = Boolean(shop && listing.orderable && listing.status === "published" && listing.quantity > 0 && listing.price !== null);

  const isOwner = viewer?.id === listing.seller_id;
  const isLive = listing.status === "published";
  const seller = listing.seller;
  const category = listing.category;
  const attrs = listing.values.filter((v) => v.attribute && attrValue(v) !== "");
  const others = similar.items.filter((l) => l.id !== listing.id).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description.slice(0, 500),
    image: listing.images.map((i) => listingImageUrl(i.storage_path)),
    offers: listing.price !== null ? {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      availability: isLive ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    } : undefined,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {isLive ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}

      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-faint">
        <Link href="/" className="hover:text-brand">Home</Link>
        {category.parent ? <> / <Link href={`/categories/${category.parent.slug}`} className="hover:text-brand">{category.parent.name}</Link></> : null}
        {" / "}<Link href={`/categories/${category.slug}`} className="hover:text-brand">{category.name}</Link>
      </nav>

      {isOwner && !isLive ? (
        <div className="mb-4">
          <FormMessage tone="info">
            Only you can see this listing. Status: <strong>{statusLabel[listing.status]}</strong>
            {listing.moderation_note ? <> — moderator note: {listing.moderation_note}</> : null}.{" "}
            <Link href={`/seller-dashboard/listings/${listing.id}/edit`} className="font-medium underline">Edit listing</Link>
          </FormMessage>
        </div>
      ) : null}
      {listing.status === "sold" ? (
        <div className="mb-4"><FormMessage tone="info">This item has been sold.</FormMessage></div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ImageGallery images={listing.images} title={listing.title} />

          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {conditionLabel[listing.condition] ? (
                <div><dt className="text-ink-faint">Condition</dt><dd className="font-medium">{conditionLabel[listing.condition]}</dd></div>
              ) : null}
              {listing.quantity > 1 ? (
                <div><dt className="text-ink-faint">Quantity</dt><dd className="font-medium tabular">{listing.quantity}</dd></div>
              ) : null}
              {attrs.map((v) => (
                <div key={v.attribute!.key}><dt className="text-ink-faint">{v.attribute!.label}</dt><dd className="font-medium">{attrValue(v)}</dd></div>
              ))}
            </dl>
            <h2 className="mt-6 font-display text-lg font-bold">Description</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ink">{listing.description}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-ink-faint">
              <span className="flex items-center gap-1"><CalendarDays size={14} aria-hidden /> Posted {timeAgo(listing.published_at ?? listing.created_at)}</span>
              <span className="flex items-center gap-1"><Eye size={14} aria-hidden /> {listing.view_count.toLocaleString()} views</span>
              {!isOwner ? <ReportButton targetType="listing" targetId={listing.id} signedIn={Boolean(viewer)} label="Report this listing" className="ml-auto text-xs" /> : null}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <Price value={listing.price} currency={listing.currency} negotiable={listing.is_negotiable} size="lg" />
              <FavoriteButton listingId={listing.id} initial={favs.has(listing.id)} signedIn={Boolean(viewer)} compact />
            </div>
            <h1 className="mt-2 text-xl font-semibold leading-snug">{listing.title}</h1>
            <div className="mt-2"><LocationLabel city={listing.city} region={listing.region?.name} /></div>

            <div className="mt-5">
              {isOwner ? (
                <div className="flex flex-col gap-2">
                  <ButtonLink href={`/seller-dashboard/listings/${listing.id}/edit`} size="lg">Edit listing</ButtonLink>
                  <ButtonLink href="/seller-dashboard/listings" variant="secondary">Manage listings</ButtonLink>
                </div>
              ) : (
                <>
                {canOrderOnline ? (
                  <div className="mb-3 flex flex-col gap-1.5">
                    <AddToShopCart listingId={listing.id} stock={listing.quantity} signedIn={Boolean(viewer)} />
                    <p className="text-xs text-ink-soft">
                      {listing.quantity <= 5 ? `Only ${listing.quantity} left. ` : ""}Pay {shop!.name} directly{shop!.accepts_pay_on_delivery ? " on delivery" : ""}{shop!.accepts_momo ? `${shop!.accepts_pay_on_delivery ? " or" : ""} by MoMo` : ""}.
                    </p>
                  </div>
                ) : null}
                <ContactActions
                  listingId={listing.id}
                  slug={listing.slug}
                  title={listing.title}
                  canContact={isLive}
                  secondary={Boolean(canOrderOnline)}
                  phoneAvailable={Boolean(sharesPhone.data)}
                  signedIn={Boolean(viewer)}
                />
                </>
              )}
            </div>
            <div className="mt-3 flex justify-end"><ShareButton title={listing.title} /></div>
          </Card>

          {seller ? (
            <Card className="p-5">
              <Link href={`/seller/${seller.username ?? seller.id}`} className="flex items-center gap-3 hover:text-brand">
                <UserAvatar name={seller.display_name} path={seller.avatar_path} size={48} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{seller.display_name}</p>
                  <p className="text-xs text-ink-faint">On {site.name} since {formatDate(seller.created_at)}</p>
                </div>
              </Link>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {seller.is_verified ? (
                  <Badge tone="success"><ShieldCheck size={12} aria-hidden /> Verified seller</Badge>
                ) : (
                  <Badge>Not yet verified</Badge>
                )}
                {stats.rating ? (
                  <Badge tone="gold"><Star size={12} aria-hidden fill="currentColor" /> {stats.rating.average} ({stats.rating.total} {stats.rating.total === 1 ? "review" : "reviews"})</Badge>
                ) : null}
                <Badge>{stats.activeCount} active {stats.activeCount === 1 ? "ad" : "ads"}</Badge>
              </div>
              {shop ? (
                <Link href={`/shop/${shop.slug}`} className="mt-4 flex items-center gap-3 border-t border-line pt-4 hover:text-brand">
                  <ShopLogo path={shop.logo_path} name={shop.name} size={36} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{shop.name}</span>
                  <span className="text-sm font-medium text-brand">Visit shop</span>
                </Link>
              ) : null}
              {!isOwner ? (
                <div className="mt-3"><ReportButton targetType="user" targetId={seller.id} signedIn={Boolean(viewer)} label="Report seller" className="text-xs" /></div>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert size={16} className="text-gold" aria-hidden />Stay safe</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              <li>Never pay a deposit or send MoMo before you see the item.</li>
              <li>Meet in a busy public place and bring someone along.</li>
              <li>Check documents and test the item before paying.</li>
            </ul>
            <Link href="/safety" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">More safety tips</Link>
          </Card>
        </div>
      </div>

      {others.length ? (
        <section className="mt-10" aria-labelledby="similar">
          <h2 id="similar" className="mb-4 font-display text-xl font-bold">More in {category.name}</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {others.map((l) => <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={Boolean(viewer)} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
