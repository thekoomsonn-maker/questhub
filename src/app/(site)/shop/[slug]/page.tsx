import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock, MapPin, MessageCircle, Phone, Truck, Wallet } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getShopBySlug, isFeatured } from "@/lib/data/shops";
import { getFavoriteIds } from "@/lib/data/viewer";
import { getSellerStats } from "@/lib/data/listings";
import { createClient } from "@/lib/supabase/server";
import { avatarUrl } from "@/lib/images";
import { formatDate } from "@/lib/format";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { ShopLogo } from "@/components/shops/shop-card";
import { ReportButton } from "@/components/report-button";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/field";

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) return { title: "Shop not found" };
  const img = avatarUrl(shop.banner_path ?? shop.logo_path);
  return { title: shop.name, description: shop.tagline ?? shop.about?.slice(0, 150) ?? undefined, openGraph: { images: img ? [img] : undefined } };
}

export default async function ShopPage({ params, searchParams }: PageProps<"/shop/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("id,slug,title,price,currency,is_negotiable,condition,city,published_at,status,seller_id,orderable,quantity,region:regions(name),images:listing_images(storage_path,sort_order)")
    .eq("seller_id", shop.owner_id)
    .eq("status", "published")
    .order("orderable", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(96);
  if (q) query = query.ilike("title", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const [viewer, favs, stats, { data: listings }] = await Promise.all([getViewer(), getFavoriteIds(), getSellerStats(shop.owner_id), query]);
  const isOwner = viewer?.id === shop.owner_id;
  const banner = avatarUrl(shop.banner_path);
  const wa = shop.whatsapp?.replace(/^0/, "233").replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {shop.status !== "active" ? (
        <div className="mb-4"><FormMessage tone="info">Only you can see this page until your shop is approved.</FormMessage></div>
      ) : null}
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="h-32 bg-brand sm:h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {banner ? <img src={banner} alt="" className="h-full w-full object-cover" /> : <div className="weave h-full" />}
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <div className="-mt-14 sm:-mt-16"><ShopLogo path={shop.logo_path} name={shop.name} size={88} /></div>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight">
              {shop.name}
              {shop.is_verified ? <BadgeCheck className="shrink-0 text-success" size={24} aria-label="Verified business" /> : null}
            </h1>
            {shop.tagline ? <p className="text-ink-soft">{shop.tagline}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shop.is_verified ? <Badge tone="success">Verified business</Badge> : null}
              {isFeatured(shop) ? <Badge tone="gold">Featured</Badge> : null}
              {stats.rating ? <Badge tone="gold">★ {stats.rating.average} ({stats.rating.total})</Badge> : null}
              <Badge>{stats.activeCount} products</Badge>
              <Badge>On QuestHub since {formatDate(shop.created_at)}</Badge>
            </div>
          </div>
          {!isOwner ? (
            <div className="flex flex-wrap gap-2">
              {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-field)] border border-line-strong px-4 text-sm font-medium hover:bg-paper"><MessageCircle size={16} aria-hidden /> WhatsApp</a> : null}
              {shop.phone ? <a href={`tel:${shop.phone}`} className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-field)] border border-line-strong px-4 text-sm font-medium hover:bg-paper"><Phone size={16} aria-hidden /> Call</a> : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section aria-labelledby="products">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="products" className="font-display text-xl font-semibold">Products</h2>
            <form method="get" role="search" className="flex gap-2">
              <Input name="q" defaultValue={q} placeholder={`Search ${shop.name}`} aria-label="Search this shop" className="h-10 w-56" />
            </form>
          </div>
          {!listings?.length ? (
            <EmptyState title={q ? "Nothing matches" : "No products yet"} body={q ? "Try another word." : "This shop hasn't listed anything yet."} />
          ) : (
            <ListingGrid>
              {listings.map((l) => (
                <ListingCard
                  key={l.id}
                  favorited={favs.has(l.id)}
                  signedIn={Boolean(viewer)}
                  buyOnline={l.orderable && l.quantity > 0}
                  listing={{
                    id: l.id, slug: l.slug, title: l.title, price: l.price, currency: l.currency, is_negotiable: l.is_negotiable, condition: l.condition,
                    city: l.city, region_name: l.region?.name ?? null, published_at: l.published_at, status: l.status, seller_id: l.seller_id,
                    seller_verified: shop.is_verified, cover_path: [...l.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
                    is_boosted: false, is_featured: false, total_count: 0,
                  }}
                />
              ))}
            </ListingGrid>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          {shop.about ? <Card className="p-5"><h2 className="text-sm font-semibold">About</h2><p className="mt-2 whitespace-pre-line text-sm">{shop.about}</p></Card> : null}
          <Card className="divide-y divide-line text-sm">
            {shop.city || shop.region ? <p className="flex gap-3 p-4"><MapPin size={18} className="shrink-0 text-brand" aria-hidden />{[shop.address, shop.city, shop.region?.name].filter(Boolean).join(", ")}</p> : null}
            {shop.opening_hours ? <p className="flex gap-3 p-4"><Clock size={18} className="shrink-0 text-brand" aria-hidden />{shop.opening_hours}</p> : null}
            {shop.delivery_info ? <p className="flex gap-3 p-4"><Truck size={18} className="shrink-0 text-brand" aria-hidden /><span className="whitespace-pre-line">{shop.delivery_info}</span></p> : null}
            <p className="flex gap-3 p-4"><Wallet size={18} className="shrink-0 text-brand" aria-hidden />
              <span>{[shop.accepts_pay_on_delivery ? "Pay on delivery" : null, shop.accepts_momo ? "MoMo to the shop" : null].filter(Boolean).join(" or ")}. You pay the shop directly; QuestHub doesn&apos;t handle the money.</span>
            </p>
          </Card>
          {!isOwner ? <ReportButton targetType="user" targetId={shop.owner_id} signedIn={Boolean(viewer)} label="Report this shop" className="text-xs" /> : null}
        </aside>
      </div>
    </div>
  );
}
