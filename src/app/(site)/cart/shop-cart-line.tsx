"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setShopCartQuantity } from "../shop/actions";

export function ShopCartLineControls({ listingId, quantity, max }: { listingId: string; quantity: number; max: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (q: number) => start(async () => {
    const r = await setShopCartQuantity(listingId, q, "set");
    if (!r.ok) toast.error(r.error);
    router.refresh();
  });
  return (
    <div className="flex flex-col items-end gap-2">
      <label className="sr-only" htmlFor={`sq-${listingId}`}>Quantity</label>
      <select id={`sq-${listingId}`} value={quantity} disabled={pending} onChange={(e) => set(Number(e.target.value))} className="h-9 rounded-[var(--radius-field)] border border-line-strong bg-surface px-2 text-sm">
        {Array.from({ length: Math.max(1, max) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <button type="button" disabled={pending} onClick={() => set(0)} className="flex items-center gap-1 text-xs text-ink-soft hover:text-danger"><Trash2 size={14} aria-hidden /> Remove</button>
    </div>
  );
}
