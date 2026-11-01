"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { formatPrice } from "@/lib/format";
import type { Region } from "@/lib/data/catalog";
import type { ActionResult } from "@/lib/utils";
import { placeGoodsOrder } from "./actions";
import { PaymentMethodPicker, type PaymentMethodOption } from "@/components/store/payment-method";

type Fees = { byRegion: Record<string, number>; fallback: number; freeOver: number };

export function deliveryFee(fees: Fees, regionId: number | null, subtotal: number) {
  if (!regionId) return null;
  if (fees.freeOver > 0 && subtotal >= fees.freeOver) return 0;
  return fees.byRegion[String(regionId)] ?? fees.fallback;
}

export function CheckoutForm({ regions, items, subtotal, fees, defaults, disabled, paymentOptions }: {
  regions: Region[];
  items: { name: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  fees: Fees;
  defaults: { name: string; phone: string; regionId: number | null; city: string };
  disabled: boolean;
  paymentOptions: PaymentMethodOption;
}) {
  const [method, setMethod] = useState<"mobile_money_card" | "crypto">("mobile_money_card");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(placeGoodsOrder, null);
  const [region, setRegion] = useState<number | null>(defaults.regionId);
  const fee = deliveryFee(fees, region, subtotal);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_320px]" noValidate>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-display text-lg font-semibold sm:col-span-2">Delivery details</h2>
        {state && !state.ok ? <div className="sm:col-span-2"><FormMessage>{state.error}</FormMessage></div> : null}
        <Field id="name" label="Recipient name" required error={fe("name")}>
          <Input id="name" name="name" defaultValue={defaults.name} autoComplete="name" />
        </Field>
        <Field id="phone" label="Phone for the rider" required error={fe("phone")}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} placeholder="024 123 4567" autoComplete="tel" />
        </Field>
        <Field id="regionId" label="Region" required error={fe("regionId")}>
          <Select id="regionId" name="regionId" defaultValue={defaults.regionId ?? ""} onChange={(e) => setRegion(Number(e.target.value) || null)}>
            <option value="">Choose a region</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field id="city" label="Town or area" required error={fe("city")}>
          <Input id="city" name="city" defaultValue={defaults.city} placeholder="e.g. Spintex" />
        </Field>
        <Field id="address" label="Address" required hint="Street, house number or landmark. GhanaPost GPS address helps." error={fe("address")} className="sm:col-span-2">
          <Textarea id="address" name="address" rows={2} maxLength={300} placeholder="e.g. GA-183-8164, opposite the Shell filling station" />
        </Field>
        <Field id="notes" label="Note for the rider (optional)" className="sm:col-span-2">
          <Input id="notes" name="notes" maxLength={500} placeholder="e.g. Call when you reach the junction" />
        </Field>
      </Card>
      <Card className="h-fit p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-lg font-semibold">Order summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.name} className="flex justify-between gap-3"><span className="min-w-0 truncate">{i.quantity} × {i.name}</span><span className="tabular">{formatPrice(i.lineTotal)}</span></li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular">{fee === null ? "Choose a region" : fee === 0 ? "Free" : formatPrice(fee)}</dd></div>
          <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd className="font-display tabular">{formatPrice(subtotal + (fee ?? 0))}</dd></div>
        </dl>
        <div className="mt-4"><PaymentMethodPicker value={method} onChange={setMethod} options={paymentOptions} totalGhs={subtotal + (fee ?? 0)} /></div>
        <Button type="submit" size="lg" className="mt-4 w-full" pending={pending} disabled={disabled}>
          <Lock size={16} aria-hidden /> Pay {formatPrice(subtotal + (fee ?? 0))}
        </Button>
        <p className="mt-2 text-center text-xs text-ink-faint">You&apos;ll pay on the provider&apos;s secure page next. We never see your PIN, card number or wallet keys.</p>
      </Card>
    </form>
  );
}
