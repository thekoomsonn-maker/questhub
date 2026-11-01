"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { AdminActionButton } from "../action-button";
import { activatePromotionTest, cancelPromotionAdmin, updatePlan } from "../actions";

export function PlanRow({ plan }: { plan: { id: string; name: string; price: number; durationDays: number; isActive: boolean } }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(plan.price));
  const [days, setDays] = useState(String(plan.durationDays));
  const [active, setActive] = useState(plan.isActive);
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-center gap-3 p-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await updatePlan(plan.id, { price, durationDays: days, isActive: active });
        if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
      });
    }}>
      <span className="min-w-40 flex-1 text-sm font-medium">{plan.name}</span>
      <label className="flex items-center gap-1 text-sm">GH₵ <Input value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-24" inputMode="decimal" aria-label={`${plan.name} price`} /></label>
      <label className="flex items-center gap-1 text-sm"><Input value={days} onChange={(e) => setDays(e.target.value)} className="h-9 w-16" inputMode="numeric" aria-label={`${plan.name} days`} /> days</label>
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--brand)]" /> Offered</label>
      <Button type="submit" size="sm" variant="secondary" pending={pending}>Save</Button>
    </form>
  );
}

export function PromotionActions({ id, status, testMode }: { id: string; status: string; testMode: boolean }) {
  if (status !== "pending_payment" && status !== "active") return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "pending_payment" && testMode ? (
        <AdminActionButton label="Activate (test)" title="Activate without payment?" body="For testing only. It will be recorded as a test promotion, not as paid revenue." requireReason action={(r) => activatePromotionTest(id, r)} />
      ) : null}
      <AdminActionButton label="Cancel" variant="ghost" tone="danger" title="Cancel this promotion?" requireReason action={(r) => cancelPromotionAdmin(id, r)} />
    </div>
  );
}
