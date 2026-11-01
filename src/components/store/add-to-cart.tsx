"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCartQuantity } from "@/app/(site)/store/actions";

export function AddToCartButton({
  productId,
  disabled,
  signedIn,
  compact = false,
  maxQuantity = 1,
}: {
  productId: string;
  disabled?: boolean;
  signedIn: boolean;
  compact?: boolean;
  maxQuantity?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();

  function add() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    start(async () => {
      const r = await setCartQuantity(productId, qty, "add");
      if (r.ok) {
        toast.success(r.message, { action: { label: "View cart", onClick: () => router.push("/cart") } });
        router.refresh();
      } else toast.error(r.error);
    });
  }

  if (compact) {
    return (
      <Button size="sm" variant="secondary" className="w-full" disabled={disabled} pending={pending} onClick={add}>
        {!pending ? <ShoppingCart size={14} aria-hidden /> : null} {disabled ? "Sold out" : "Add to cart"}
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`qty-${productId}`}>Quantity</label>
      <select
        id={`qty-${productId}`}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        disabled={disabled}
        className="h-12 w-20 rounded-[var(--radius-field)] border border-line-strong bg-surface px-2 text-base"
      >
        {Array.from({ length: Math.max(1, Math.min(10, maxQuantity)) }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>
      <Button size="lg" className="flex-1" disabled={disabled} pending={pending} onClick={add}>
        {!pending ? <ShoppingCart size={18} aria-hidden /> : null} {disabled ? "Out of stock" : "Add to cart"}
      </Button>
    </div>
  );
}
