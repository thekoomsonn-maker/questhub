import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { discountPercent, getProductBySlug } from "@/lib/data/store";
import { formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { ImageGallery } from "@/components/listings/image-gallery";
import { AddToCartButton } from "@/components/store/add-to-cart";
import { StockLabel } from "@/components/store/product-card";
import { Card } from "@/components/ui/misc";

export async function generateMetadata({ params }: PageProps<"/store/[slug]">): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Product not found" };
  const img = productImageUrl(p.images[0]?.storage_path);
  return { title: `${p.brand ? `${p.brand} ` : ""}${p.name}`, description: `${formatPrice(p.price)} at QuestHub Store. ${p.description.slice(0, 140)}`, openGraph: { images: img ? [img] : undefined } };
}

export default async function ProductPage({ params }: PageProps<"/store/[slug]">) {
  const [product, viewer] = await Promise.all([getProductBySlug((await params).slug), getViewer()]);
  if (!product) notFound();
  const off = discountPercent(Number(product.price), product.compare_at_price ? Number(product.compare_at_price) : null);
  const images = product.images.map((i) => ({ id: i.storage_path, storage_path: i.storage_path }));
  const title = `${product.brand ? `${product.brand} ` : ""}${product.name}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-faint">
        <Link href="/store" className="hover:text-brand">Store</Link>
        {product.category ? <> / <Link href={`/store?category=${product.category.slug}`} className="hover:text-brand">{product.category.name}</Link></> : null}
      </nav>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <ImageGallery images={images} title={title} bucket="product-images" />
        <div className="flex flex-col gap-4">
          <div>
            {product.brand ? <p className="text-sm font-medium text-ink-soft">{product.brand}</p> : null}
            <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{product.name}</h1>
          </div>
          <div className="flex items-baseline gap-3">
            <p className="font-display text-3xl font-bold tabular">{formatPrice(product.price)}</p>
            {off ? <><p className="text-ink-faint line-through tabular">{formatPrice(product.compare_at_price)}</p><span className="rounded-md bg-danger px-1.5 py-0.5 text-xs font-bold text-white">-{off}%</span></> : null}
          </div>
          <StockLabel stock={product.stock} />
          <AddToCartButton productId={product.id} disabled={product.stock === 0} signedIn={Boolean(viewer)} maxQuantity={product.stock} />
          <Card className="divide-y divide-line text-sm">
            <p className="flex gap-3 p-3"><Truck size={18} className="shrink-0 text-brand" aria-hidden /> Delivered to your door. Fee shown at checkout; free on large orders.</p>
            {product.warranty ? <p className="flex gap-3 p-3"><ShieldCheck size={18} className="shrink-0 text-brand" aria-hidden /> {product.warranty}</p> : null}
            <p className="flex gap-3 p-3"><RotateCcw size={18} className="shrink-0 text-brand" aria-hidden /> Wrong or faulty item? Contact us within 7 days of delivery.</p>
          </Card>
          <section>
            <h2 className="font-display text-lg font-bold">About this item</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{product.description}</p>
            {product.sku ? <p className="mt-3 text-xs text-ink-faint">SKU {product.sku}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
