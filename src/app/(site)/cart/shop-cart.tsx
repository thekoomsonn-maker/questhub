import Link from "next/link";
import { getShopCart } from "@/lib/data/shops";
import { formatPrice } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { ButtonLink } from "@/components/ui/button";
import { ShopLogo } from "@/components/shops/shop-card";
import { ShopCartLineControls } from "./shop-cart-line";

/** Items from vendor shops, grouped by shop. Each shop is checked out separately. */
export async function ShopCartSection({ userId }: { userId: string }) {
  const groups = (await getShopCart(userId)).filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <section className="mt-8" aria-labelledby="shop-cart">
      <h2 id="shop-cart" className="font-display text-xl font-semibold">From shops</h2>
      <p className="mb-3 text-sm text-ink-soft">Each shop confirms and delivers its own order. You pay the shop directly.</p>
      <div className="flex flex-col gap-4">
        {groups.map(({ shop, items, subtotal }) => {
          const problem = items.some((i) => i.listing.status !== "published" || !i.listing.orderable || i.listing.quantity < i.quantity);
          return (
            <div key={shop.id} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3">
                <ShopLogo path={shop.logo_path} name={shop.name} size={32} />
                <Link href={`/shop/${shop.slug}`} className="flex-1 font-medium hover:text-brand">{shop.name}</Link>
                <span className="font-display font-semibold tabular">{formatPrice(subtotal)}</span>
              </div>
              <ul className="divide-y divide-line">
                {items.map(({ listing: l, quantity }) => {
                  const cover = [...l.images].sort((a, b) => a.sort_order - b.sort_order)[0];
                  const issue = l.status !== "published" || !l.orderable ? "No longer available online" : l.quantity < quantity ? (l.quantity ? `Only ${l.quantity} left` : "Sold out") : null;
                  return (
                    <li key={l.id} className="flex gap-3 p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover ? <img src={listingImageUrl(cover.storage_path)!} alt="" className="h-16 w-16 shrink-0 rounded-[8px] object-cover" /> : <div className="h-16 w-16 rounded-[8px] bg-paper" />}
                      <div className="min-w-0 flex-1">
                        <Link href={`/listing/${l.slug}`} className="line-clamp-2 text-sm font-medium hover:text-brand">{l.title}</Link>
                        <p className="font-display font-semibold tabular">{formatPrice(l.price, l.currency)}</p>
                        {issue ? <p className="text-xs font-medium text-danger">{issue}</p> : null}
                      </div>
                      <ShopCartLineControls listingId={l.id} quantity={quantity} max={Math.max(quantity, Math.min(50, l.quantity))} />
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end border-t border-line p-3">
                {problem ? <p className="text-sm text-danger">Fix the items marked above to order.</p> : <ButtonLink href={`/cart/shop/${shop.id}`}>Order from {shop.name}</ButtonLink>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
