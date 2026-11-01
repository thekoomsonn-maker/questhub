import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck, Star } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getSellerStats } from "@/lib/data/listings";
import { getFavoriteIds } from "@/lib/data/viewer";
import { formatDate, timeAgo } from "@/lib/format";
import { site } from "@/config/site";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { UserAvatar } from "@/components/user-avatar";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { ReportButton } from "@/components/report-button";
import { BlockButton } from "./block-button";

async function loadSeller(idOrUsername: string) {
  const supabase = await createClient();
  const isId = z.uuid().safeParse(idOrUsername).success;
  const { data } = await supabase
    .from("profiles")
    .select("id,display_name,username,avatar_path,bio,city,is_verified,verified_at,created_at,region:regions(name)")
    .eq(isId ? "id" : "username", idOrUsername.toLowerCase())
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/seller/[id]">): Promise<Metadata> {
  const s = await loadSeller((await params).id);
  return s ? { title: `${s.display_name} on ${site.name}`, description: s.bio ?? undefined } : { title: "Seller not found" };
}

export default async function SellerPage({ params }: PageProps<"/seller/[id]">) {
  const seller = await loadSeller((await params).id);
  if (!seller) notFound();
  const supabase = await createClient();
  const [viewer, favs, stats, reviews] = await Promise.all([
    getViewer(),
    getFavoriteIds(),
    getSellerStats(seller.id),
    supabase.from("reviews").select("id,rating,comment,created_at,reviewer:profiles!reviews_reviewer_id_fkey(display_name)").eq("seller_id", seller.id).eq("is_hidden", false).order("created_at", { ascending: false }).limit(10),
  ]);
  // Seller's public listings (RLS limits this to live and sold ones for visitors)
  const { data: own } = await supabase
    .from("listings")
    .select("id,slug,title,price,currency,is_negotiable,condition,city,published_at,status,seller_id,region:regions(name),images:listing_images(storage_path,sort_order)")
    .eq("seller_id", seller.id)
    .in("status", ["published", "sold"])
    .order("published_at", { ascending: false })
    .limit(48);

  const cards = (own ?? []).map((l) => ({
    id: l.id, slug: l.slug, title: l.title, price: l.price, currency: l.currency, is_negotiable: l.is_negotiable,
    condition: l.condition, city: l.city, region_name: l.region?.name ?? null, published_at: l.published_at, status: l.status,
    seller_id: l.seller_id, seller_verified: seller.is_verified,
    cover_path: [...l.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
    is_boosted: false, is_featured: false, total_count: 0,
  }));
  const isSelf = viewer?.id === seller.id;
  let blocked = false;
  if (viewer && !isSelf) {
    const { data } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewer.id).eq("blocked_id", seller.id).maybeSingle();
    blocked = Boolean(data);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
        <UserAvatar name={seller.display_name} path={seller.avatar_path} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{seller.display_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {seller.is_verified ? (
              <Badge tone="success"><ShieldCheck size={12} aria-hidden /> Verified seller{seller.verified_at ? ` since ${formatDate(seller.verified_at)}` : ""}</Badge>
            ) : <Badge>Not yet verified</Badge>}
            {stats.rating ? <Badge tone="gold"><Star size={12} fill="currentColor" aria-hidden /> {stats.rating.average} from {stats.rating.total} confirmed {stats.rating.total === 1 ? "sale" : "sales"}</Badge> : null}
            {seller.city || seller.region ? <span className="flex items-center gap-1"><MapPin size={14} aria-hidden />{[seller.city, seller.region?.name].filter(Boolean).join(", ")}</span> : null}
            <span>Joined {formatDate(seller.created_at)}</span>
          </div>
          {seller.bio ? <p className="mt-3 max-w-prose whitespace-pre-line text-[15px] text-ink">{seller.bio}</p> : null}
          <p className="mt-3 text-sm text-ink-soft">{stats.activeCount} active · {stats.soldCount} sold on {site.name}</p>
        </div>
        {!isSelf ? (
          <div className="flex gap-3 sm:flex-col sm:items-end">
            <ReportButton targetType="user" targetId={seller.id} signedIn={Boolean(viewer)} label="Report seller" />
            {viewer ? <BlockButton userId={seller.id} initial={blocked} /> : null}
          </div>
        ) : null}
      </Card>

      <section className="mt-8" aria-labelledby="ads">
        <h2 id="ads" className="mb-4 font-display text-xl font-semibold">Listings</h2>
        {cards.length ? (
          <ListingGrid>{cards.map((l) => <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={Boolean(viewer)} />)}</ListingGrid>
        ) : <EmptyState title="No active listings" body="This seller has nothing for sale right now." />}
      </section>

      {reviews.data?.length ? (
        <section className="mt-8" aria-labelledby="reviews">
          <h2 id="reviews" className="mb-1 font-display text-xl font-semibold">Reviews</h2>
          <p className="mb-4 text-sm text-ink-soft">Only buyers the seller confirmed a sale with can leave a review.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {reviews.data.map((r) => (
              <li key={r.id}><Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="flex gap-0.5 text-gold" aria-label={`${r.rating} out of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} fill={i < r.rating ? "currentColor" : "none"} aria-hidden />)}</span>
                  <span className="text-xs text-ink-faint">{timeAgo(r.created_at)}</span>
                </div>
                {r.comment ? <p className="mt-2 text-sm">{r.comment}</p> : null}
                <p className="mt-2 text-xs text-ink-faint">{r.reviewer?.display_name ?? "Buyer"}</p>
              </Card></li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
