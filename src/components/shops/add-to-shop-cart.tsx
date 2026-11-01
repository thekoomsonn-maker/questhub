"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setShopCartQuantity } from "@/app/(site)/shop/actions";

export function AddToShopCart({ listingId, stock, signedIn }: { listingId: string; stock: number; signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`sqty-${listingId}`}>Quantity</label>
      <select id={`sqty-${listingId}`} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="h-12 w-20 rounded-[var(--radius-field)] border border-line-strong bg-surface px-2">
        {Array.from({ length: Math.min(10, stock) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <Button size="lg" className="flex-1" pending={pending} onClick={() => {
        if (!signedIn) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
        start(async () => {
          const r = await setShopCartQuantity(listingId, qty, "add");
          if (r.ok) {
            toast.success(r.message, { action: { label: "View cart", onClick: () => router.push("/cart") } });
            router.refresh();
          } else toast.error(r.error);
        });
      }}>
        {!pending ? <ShoppingBag size={18} aria-hidden /> : null} Order online
      </Button>
    </div>
  );
}
