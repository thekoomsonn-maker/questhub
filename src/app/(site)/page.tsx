import Link from "next/link";
import { Suspense } from "react";
import { Eye, HandCoins, MessageCircle, Smartphone, Users } from "lucide-react";
import { getCategoryTree } from "@/lib/data/catalog";
import { getFeaturedListings, searchListings } from "@/lib/data/listings";
import { getFavoriteIds } from "@/lib/data/viewer";
import { getProducts } from "@/lib/data/store";
import { ProductCard } from "@/components/store/product-card";
import { listShops } from "@/lib/data/shops";
import { ShopCard } from "@/components/shops/shop-card";
import { getViewer } from "@/lib/auth";
import { SearchBar } from "@/components/layout/search-bar";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { CategoryIcon } from "@/components/listings/category-icon";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";

export default async function HomePage() {
  const categories = await getCategoryTree();
  const quick = ["mobile-phones", "cars", "property-for-rent", "laptops-computers", "furniture", "generators-solar"];
  const quickLinks = categories.flatMap((c) => c.children).filter((c) => quick.includes(c.slug));

  return (
    <>
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-7xl px-4 pb-9 pt-9 sm:pb-12 sm:pt-16">
          <h1 className="max-w-3xl font-display text-[2.5rem] font-extrabold leading-[0.98] sm:text-[4.25rem]">
            Everything Circle sells. None of the traffic.
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">
            Phones, cars, rooms to rent, generators and kente from people and shops in all 16 regions.
            Chat with the seller here, and pay once you&apos;ve seen the item.
          </p>
          <div className="mt-7 hidden max-w-2xl text-ink sm:block">
            <Suspense fallback={<div className="h-14 rounded-full bg-surface" />}>
              <SearchBar large />
            </Suspense>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Popular categories">
            {quickLinks.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="inline-flex h-9 items-center rounded-full border border-white/30 px-3.5 text-sm font-medium text-white hover:bg-white hover:text-brand"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="kente-strip" aria-hidden />
      </section>

      <div className="mx-auto max-w-7xl px-4">
        <section className="pb-4 pt-9" aria-labelledby="cats">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="cats" className="font-display text-xl font-bold">Categories</h2>
            <Link href="/categories" className="text-sm font-medium text-brand hover:underline">See all</Link>
          </div>
          <ul className="grid grid-cols-2 gap-x-6 border-t border-line sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c) => (
              <li key={c.id} className="border-b border-line">
                <Link href={`/categories/${c.slug}`} className="group flex items-center gap-3 py-3.5 text-[15px] font-medium leading-tight hover:text-brand">
                  <CategoryIcon name={c.icon} size={20} className="shrink-0 text-ink-faint group-hover:text-brand" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Suspense fallback={null}>
          <StoreRow />
        </Suspense>

        <Suspense fallback={null}>
          <FeaturedShops />
        </Suspense>

        <Suspense fallback={<GridSkeleton title="Featured" />}>
          <Featured />
        </Suspense>

        <Suspense fallback={<GridSkeleton title="Just added" />}>
          <Recent />
        </Suspense>

        <section className="my-10 grid gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-bold">Have something to sell?</h2>
            <p className="mt-2 max-w-md text-ink-soft">
              Post an ad in a few minutes. It&apos;s free, buyers message you directly, and you choose whether to share your number.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ButtonLink href="/sell" size="lg">Post an ad</ButtonLink>
              <ButtonLink href="/safety" size="lg" variant="secondary">How we keep trading safe</ButtonLink>
            </div>
          </div>
          <ul className="grid gap-4 text-sm sm:grid-cols-2" aria-label="Safety tips">
            <li className="flex gap-3"><Users className="shrink-0 text-brand" size={20} aria-hidden /><span><strong className="block font-medium">Meet in public</strong><span className="text-ink-soft">A mall, bank or busy junction in daylight.</span></span></li>
            <li className="flex gap-3"><Eye className="shrink-0 text-brand" size={20} aria-hidden /><span><strong className="block font-medium">Inspect first</strong><span className="text-ink-soft">Test the item and check documents before paying.</span></span></li>
            <li className="flex gap-3"><HandCoins className="shrink-0 text-brand" size={20} aria-hidden /><span><strong className="block font-medium">No deposits upfront</strong><span className="text-ink-soft">Never send MoMo for an item you haven&apos;t seen.</span></span></li>
            <li className="flex gap-3"><MessageCircle className="shrink-0 text-brand" size={20} aria-hidden /><span><strong className="block font-medium">Keep chats here</strong><span className="text-ink-soft">So you can report anything suspicious.</span></span></li>
          </ul>
        </section>
      </div>
    </>
  );
}

async function StoreRow() {
  const [{ items }, viewer] = await Promise.all([getProducts({ pageSize: 5 }), getViewer()]);
  return (
    <section className="py-6" aria-labelledby="store">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <div><h2 id="store" className="font-display text-xl font-bold">QuestHub Store</h2><p className="text-sm text-ink-soft">New items we sell and deliver ourselves.</p></div>
            <Link href="/store" className="text-sm font-medium text-brand hover:underline">Shop all</Link>
          </div>
          {items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {items.map((p) => <ProductCard key={p.id} product={p} signedIn={Boolean(viewer)} />)}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">New stock is on the way.</p>
          )}
        </div>
        <Link href="/airtime" className="flex flex-col justify-between gap-4 rounded-[var(--radius-card)] bg-gold p-5 text-ink hover:brightness-[1.03]">
          <Smartphone size={28} aria-hidden />
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">Airtime & data in seconds</h2>
            <p className="mt-1 text-sm">MTN, Telecel and AirtelTigo. Pay with Mobile Money.</p>
          </div>
          <span className="inline-flex h-10 w-fit items-center rounded-full bg-ink px-4 text-sm font-medium text-white">Top up now</span>
        </Link>
      </div>
    </section>
  );
}

async function FeaturedShops() {
  const featured = await listShops({ featuredOnly: true, limit: 4 });
  const shops = featured.length ? featured : await listShops({ limit: 4 });
  if (!shops.length) return null;
  return (
    <section className="py-6" aria-labelledby="shops">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="shops" className="font-display text-xl font-bold">
          {featured.length ? "Featured shops" : "Shops on QuestHub"}
          {featured.length ? <span className="ml-2 text-xs font-normal text-ink-faint">Paid placements</span> : null}
        </h2>
        <Link href="/shops" className="text-sm font-medium text-brand hover:underline">All shops</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{shops.map((s) => <ShopCard key={s.id} shop={s} />)}</div>
    </section>
  );
}

async function Featured() {
  const [items, viewer, favs] = await Promise.all([getFeaturedListings(8), getViewer(), getFavoriteIds()]);
  if (items.length === 0) return null;
  return (
    <section className="py-6" aria-labelledby="featured">
      <div className="mb-4 flex items-baseline gap-2">
        <h2 id="featured" className="font-display text-xl font-bold">Featured</h2>
        <span className="text-xs text-ink-faint">Paid placements</span>
      </div>
      <ListingGrid>
        {items.map((l, i) => (
          <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={Boolean(viewer)} priority={i < 4} />
        ))}
      </ListingGrid>
    </section>
  );
}

async function Recent() {
  const [{ items }, viewer, favs] = await Promise.all([
    searchListings({ sort: "newest", pageSize: 16 }),
    getViewer(),
    getFavoriteIds(),
  ]);
  return (
    <section className="py-6" aria-labelledby="recent">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="recent" className="font-display text-xl font-bold">Just added</h2>
        <Link href="/search?sort=newest" className="text-sm font-medium text-brand hover:underline">See all</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No listings yet" body="Be the first to post something for sale." action={<ButtonLink href="/sell">Post an ad</ButtonLink>} />
      ) : (
        <ListingGrid>
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={Boolean(viewer)} />
          ))}
        </ListingGrid>
      )}
    </section>
  );
}

function GridSkeleton({ title }: { title: string }) {
  return (
    <section className="py-6" aria-busy>
      <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
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
    </section>
  );
}
