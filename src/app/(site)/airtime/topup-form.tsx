"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { formatPrice } from "@/lib/format";
import { detectNetwork, networks, normaliseGhanaNumber, type Network } from "@/lib/networks";
import type { ActionResult } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { buyTopup } from "./actions";

type Bundle = { id: string; network: Network; name: string; data_mb: number | null; validity: string | null; price: number };

const presets = [5, 10, 20, 50, 100];

export function TopupForm({ bundles, min, max, signedIn, defaultNumber, disabled }: {
  bundles: Bundle[]; min: number; max: number; signedIn: boolean; defaultNumber: string; disabled: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(buyTopup, null);
  const [type, setType] = useState<"airtime" | "data">("airtime");
  const [number, setNumber] = useState(defaultNumber);
  const detected = detectNetwork(number);
  const [override, setOverride] = useState<Network | null>(null);
  const network = override ?? detected;
  const [amount, setAmount] = useState("10");
  const [bundleId, setBundleId] = useState<string>("");
  const valid = normaliseGhanaNumber(number);
  const networkBundles = bundles.filter((b) => b.network === network);
  const selectedBundle = networkBundles.find((b) => b.id === bundleId);
  const price = type === "airtime" ? Number(amount) || 0 : selectedBundle?.price ?? 0;

  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="network" value={network ?? ""} />
      {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}

      <div role="tablist" aria-label="What to buy" className="grid grid-cols-2 rounded-[var(--radius-field)] border border-line-strong bg-surface p-1">
        {(["airtime", "data"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => setType(t)}
            className={cn("h-10 rounded-[8px] text-sm font-medium", type === t ? "bg-brand text-white" : "text-ink-soft")}>
            {t === "airtime" ? "Airtime" : "Data bundle"}
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <Field id="recipient" label="Phone number to top up" required error={number && !valid ? "Enter a 10-digit Ghana number" : undefined}>
          <Input id="recipient" name="recipient" type="tel" inputMode="tel" value={number} onChange={(e) => { setNumber(e.target.value); setOverride(null); setBundleId(""); }} placeholder="024 123 4567" className="text-lg tabular" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Network {detected && !override ? <span className="font-normal text-ink-faint">(detected from the number)</span> : null}</legend>
          <div className="grid grid-cols-3 gap-2">
            {networks.map((n) => (
              <label key={n.id} className={cn("flex h-11 cursor-pointer items-center justify-center rounded-[var(--radius-field)] border text-sm font-medium", network === n.id ? "border-brand bg-brand-tint text-brand" : "border-line-strong")}>
                <input type="radio" className="sr-only" checked={network === n.id} onChange={() => { setOverride(n.id); setBundleId(""); }} />
                {n.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-faint">Moved networks but kept your number? Choose your current network.</p>
        </fieldset>

        {type === "airtime" ? (
          <Field id="amount" label="Amount (GH₵)" hint={`Between ${formatPrice(min)} and ${formatPrice(max)}`}>
            <div className="flex flex-wrap gap-2">
              {presets.filter((p) => p >= min && p <= max).map((p) => (
                <button key={p} type="button" onClick={() => setAmount(String(p))}
                  className={cn("h-10 rounded-full border px-4 text-sm font-medium tabular", amount === String(p) ? "border-brand bg-brand text-white" : "border-line-strong")}>
                  {p}
                </button>
              ))}
              <Input id="amount" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 w-28" aria-label="Custom amount" />
            </div>
          </Field>
        ) : (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Bundle</legend>
            <input type="hidden" name="bundleId" value={bundleId} />
            {!network ? (
              <p className="text-sm text-ink-soft">Enter a number or choose a network to see bundles.</p>
            ) : networkBundles.length === 0 ? (
              <p className="text-sm text-ink-soft">No bundles for this network yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {networkBundles.map((b) => (
                  <label key={b.id} className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-field)] border p-3", bundleId === b.id ? "border-brand bg-brand-tint" : "border-line-strong")}>
                    <input type="radio" className="sr-only" checked={bundleId === b.id} onChange={() => setBundleId(b.id)} />
                    <span>
                      <span className="block text-sm font-medium">{b.name}</span>
                      {b.validity ? <span className="text-xs text-ink-faint">{b.validity}</span> : null}
                    </span>
                    <span className="font-display font-semibold tabular">{formatPrice(b.price)}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
      </Card>

      {signedIn ? (
        <Button type="submit" size="lg" pending={pending} disabled={disabled || !valid || !network || price <= 0}>
          Pay {price > 0 ? formatPrice(price) : ""}
        </Button>
      ) : (
        <p className="text-center text-sm"><Link href="/login?next=/airtime" className="font-medium text-brand underline">Sign in</Link> to buy airtime and data.</p>
      )}
      <p className="text-center text-xs text-ink-faint">Double-check the number. Top-ups sent to the wrong number can&apos;t be reversed.</p>
    </form>
  );
}
