import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { coverOf, getCart } from "@/lib/data/store";
import { formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { CartLineControls } from "./cart-line";
import { ShopCartSection } from "./shop-cart";

export const metadata: Metadata = { title: "Your cart" };

export default async function CartPage() {
  const viewer = await requireViewer("/cart");
  const cart = await getCart();
  const problems = cart.items.filter((i) => !i.product.is_active || i.product.stock < i.quantity);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Your cart" />
      {cart.items.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={32} />} title="Nothing from the QuestHub Store yet" body="Browse phones, accessories and appliances in the store, or order from a shop." action={<ButtonLink href="/store">Go to the store</ButtonLink>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-3">
            {problems.length ? <FormMessage>Some items changed since you added them. Adjust the quantities marked below before checking out.</FormMessage> : null}
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
              {cart.items.map(({ product: p, quantity }) => {
                const img = productImageUrl(coverOf(p));
                const issue = !p.is_active ? "No longer available" : p.stock < quantity ? (p.stock ? `Only ${p.stock} left` : "Out of stock") : null;
                return (
                  <li key={p.id} className="flex gap-3 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img ? <img src={img} alt="" className="h-20 w-20 shrink-0 rounded-[8px] bg-white object-contain" /> : <div className="h-20 w-20 shrink-0 rounded-[8px] bg-paper" />}
                    <div className="min-w-0 flex-1">
                      <Link href={`/store/${p.slug}`} className="line-clamp-2 text-sm font-medium hover:text-brand">{p.brand ? `${p.brand} ` : ""}{p.name}</Link>
                      <p className="font-display font-semibold tabular">{formatPrice(p.price)}</p>
                      {issue ? <p className="text-xs font-medium text-danger">{issue}</p> : null}
                    </div>
                    <CartLineControls productId={p.id} quantity={quantity} max={Math.max(1, Math.min(20, p.stock))} />
                  </li>
                );
              })}
            </ul>
          </div>
          <Card className="h-fit p-5 lg:sticky lg:top-24">
            <dl className="flex justify-between text-sm"><dt>Subtotal ({cart.count} items)</dt><dd className="font-display text-lg font-semibold tabular">{formatPrice(cart.subtotal)}</dd></dl>
            <p className="mt-1 text-xs text-ink-faint">Delivery is calculated at checkout.</p>
            {problems.length ? (
              <p className="mt-4 text-sm text-danger">Fix the items marked above to continue.</p>
            ) : (
              <ButtonLink href="/checkout" size="lg" className="mt-4 w-full">Checkout</ButtonLink>
            )}
            <Link href="/store" className="mt-3 block text-center text-sm text-brand hover:underline">Continue shopping</Link>
          </Card>
        </div>
      )}
      <ShopCartSection userId={viewer.id} />
    </div>
  );
}
