"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { cancelPromotion, requestPromotion } from "./actions";

type Plan = { id: string; name: string; kind: string; duration_days: number; description: string | null; priceLabel: string };

export function PromoteForm({ listings, plans, defaultListing }: { listings: { id: string; title: string }[]; plans: Plan[]; defaultListing?: string }) {
  const router = useRouter();
  const [listing, setListing] = useState(listings.some((l) => l.id === defaultListing) ? defaultListing! : listings[0].id);
  const [plan, setPlan] = useState(plans[0].id);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestPromotion(listing, plan);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <Field id="promo-listing" label="Listing">
        <Select id="promo-listing" value={listing} onChange={(e) => setListing(e.target.value)}>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </Select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Plan</legend>
        {plans.map((p) => (
          <label key={p.id} className={cn("flex cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border p-3", plan === p.id ? "border-brand bg-brand-tint" : "border-line")}>
            <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="mt-1 accent-[var(--brand)]" />
            <span className="flex-1">
              <span className="flex justify-between gap-2 text-sm font-medium"><span>{p.name}</span><span className="font-display tabular">{p.priceLabel}</span></span>
              {p.description ? <span className="block text-xs text-ink-soft">{p.description}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" pending={pending}>Request promotion</Button>
    </form>
  );
}

export function CancelPromotionButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" pending={pending} onClick={() => start(async () => {
      const r = await cancelPromotion(id);
      if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
    })}>Cancel</Button>
  );
}
