import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { coverOf, discountPercent, type StoreProduct } from "@/lib/data/store";
import { AddToCartButton } from "./add-to-cart";

export function StockLabel({ stock }: { stock: number }) {
  return (
    <p className={`text-xs font-medium ${stock > 5 ? "text-success" : stock > 0 ? "text-[#9a6a00]" : "text-danger"}`}>
      {stock > 5 ? "In stock" : stock > 0 ? `Only ${stock} left` : "Out of stock"}
    </p>
  );
}

export function ProductCard({ product, signedIn }: { product: StoreProduct; signedIn: boolean }) {
  const img = productImageUrl(coverOf(product));
  const off = discountPercent(Number(product.price), product.compare_at_price ? Number(product.compare_at_price) : null);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface hover:border-line-strong">
      <div className="relative aspect-square bg-white">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-faint"><ImageOff size={28} aria-hidden /></div>
        )}
        {off ? <span className="absolute left-2 top-2 rounded-md bg-danger px-1.5 py-0.5 text-[11px] font-bold text-white">-{off}%</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm leading-snug">
          <Link href={`/store/${product.slug}`} className="after:absolute after:inset-0">
            {product.brand ? <span className="text-ink-soft">{product.brand} </span> : null}
            {product.name}
          </Link>
        </h3>
        <p className="font-display text-lg font-bold tabular">{formatPrice(product.price)}</p>
        {off ? <p className="text-xs text-ink-faint line-through tabular">{formatPrice(product.compare_at_price)}</p> : null}
        <StockLabel stock={product.stock} />
        <div className="relative z-10 mt-auto pt-2">
          <AddToCartButton productId={product.id} disabled={product.stock === 0} signedIn={signedIn} compact />
        </div>
      </div>
    </article>
  );
}
