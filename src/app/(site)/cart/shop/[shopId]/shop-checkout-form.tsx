"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { formatPrice } from "@/lib/format";
import type { Region } from "@/lib/data/catalog";
import type { ActionResult } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { placeShopOrder } from "../../../shop/actions";

export function ShopCheckoutForm({ shopId, shop, regions, items, subtotal, defaults }: {
  shopId: string;
  shop: { name: string; delivery_info: string | null; accepts_pay_on_delivery: boolean; accepts_momo: boolean; momo_name: string | null };
  regions: Region[];
  items: { title: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  defaults: { name: string; phone: string; regionId: number | null; city: string };
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(placeShopOrder, null);
  const [method, setMethod] = useState(shop.accepts_pay_on_delivery ? "pay_on_delivery" : "momo_to_vendor");
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const methods = [
    shop.accepts_pay_on_delivery ? { id: "pay_on_delivery", title: "Pay on delivery or pickup", body: "Cash or MoMo when you receive the item." } : null,
    shop.accepts_momo ? { id: "momo_to_vendor", title: "MoMo to the shop", body: `You'll see ${shop.momo_name ?? "the shop"}'s MoMo number after you order. Only send money once the shop confirms.` } : null,
  ].filter(Boolean) as { id: string; title: string; body: string }[];

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_320px]" noValidate>
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="method" value={method} />
      <div className="flex flex-col gap-4">
        {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Your details</h2>
          <Field id="name" label="Name" required error={fe("name")}><Input id="name" name="name" defaultValue={defaults.name} autoComplete="name" /></Field>
          <Field id="phone" label="Phone" required error={fe("phone")}><Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} placeholder="024 123 4567" /></Field>
          <Field id="regionId" label="Region"><Select id="regionId" name="regionId" defaultValue={defaults.regionId ?? ""}><option value="">Choose a region</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
          <Field id="city" label="Town or area"><Input id="city" name="city" defaultValue={defaults.city} /></Field>
          <Field id="address" label="Delivery address or pickup preference" className="sm:col-span-2"><Textarea id="address" name="address" rows={2} maxLength={300} placeholder="Street and landmark, GhanaPost GPS, or “I'll pick up”" /></Field>
          <Field id="note" label="Note for the shop (optional)" className="sm:col-span-2"><Input id="note" name="note" maxLength={500} placeholder="Size, colour, best time to call…" /></Field>
        </Card>
        {shop.delivery_info ? <Card className="p-5 text-sm"><h2 className="font-medium">Delivery from {shop.name}</h2><p className="mt-1 whitespace-pre-line text-ink-soft">{shop.delivery_info}</p></Card> : null}
      </div>
      <Card className="h-fit p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-lg font-semibold">Summary</h2>
        <ul className="mt-3 space-y-2 text-sm">{items.map((i) => <li key={i.title} className="flex justify-between gap-3"><span className="min-w-0 truncate">{i.quantity} × {i.title}</span><span className="tabular">{formatPrice(i.lineTotal)}</span></li>)}</ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-semibold"><span>Items total</span><span className="font-display tabular">{formatPrice(subtotal)}</span></div>
        <p className="text-xs text-ink-faint">Any delivery fee is agreed with the shop.</p>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">How you&apos;ll pay</legend>
          {methods.map((m) => (
            <label key={m.id} className={cn("flex cursor-pointer gap-3 rounded-[var(--radius-field)] border p-3", method === m.id ? "border-brand bg-brand-tint" : "border-line-strong")}>
              <input type="radio" checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 accent-[var(--brand)]" />
              <span><span className="block text-sm font-medium">{m.title}</span><span className="text-xs text-ink-soft">{m.body}</span></span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" size="lg" className="mt-4 w-full" pending={pending}>Place order</Button>
        <p className="mt-2 text-xs text-ink-faint">Never pay before the shop confirms your order. QuestHub doesn&apos;t handle payments for shop orders.</p>
      </Card>
    </form>
  );
}
