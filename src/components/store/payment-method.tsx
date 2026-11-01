"use client";

import { useEffect } from "react";
import { Bitcoin, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethodOption = { crypto: null | { usdRate: number } };

/** Mobile Money / card via Hubtel, or crypto via NOWPayments (when enabled). */
export function PaymentMethodPicker({ value, onChange, options, totalGhs }: {
  value: "mobile_money_card" | "crypto";
  onChange: (v: "mobile_money_card" | "crypto") => void;
  options: PaymentMethodOption;
  totalGhs: number;
}) {
  const rate = options.crypto?.usdRate ?? null;
  const usd = rate && totalGhs > 0 ? Math.ceil((totalGhs / rate) * 100) / 100 : null;
  const cryptoTooSmall = usd !== null && usd < 1;
  // Fall back to Mobile Money if the basket drops below the crypto minimum
  useEffect(() => {
    if (cryptoTooSmall && value === "crypto") onChange("mobile_money_card");
  }, [cryptoTooSmall, value, onChange]);
  if (!options.crypto) return <input type="hidden" name="method" value="mobile_money_card" />;
  const choices = [
    { id: "mobile_money_card" as const, icon: Smartphone, title: "Mobile Money or card", body: "MTN MoMo, Telecel Cash, AT Money, Visa, Mastercard" },
    { id: "crypto" as const, icon: Bitcoin, title: "Crypto", body: cryptoTooSmall ? "Available for orders of US$1 or more" : usd ? `About US$${usd.toFixed(2)} in USDT, BTC, ETH and more` : "USDT, BTC, ETH and more" },
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">Pay with</legend>
      <input type="hidden" name="method" value={value} />
      {choices.map((c) => (
        <label key={c.id} className={cn("flex cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border p-3", value === c.id ? "border-brand bg-brand-tint" : "border-line-strong", c.id === "crypto" && cryptoTooSmall && "cursor-not-allowed opacity-50")}>
          <input type="radio" checked={value === c.id} disabled={c.id === "crypto" && cryptoTooSmall} onChange={() => onChange(c.id)} className="mt-1 accent-[var(--brand)]" />
          <c.icon size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <span><span className="block text-sm font-medium">{c.title}</span><span className="text-xs text-ink-soft">{c.body}</span></span>
        </label>
      ))}
      {value === "crypto" ? (
        <p className="text-xs text-ink-faint">Rate used: GH₵{options.crypto.usdRate.toFixed(2)} = US$1. Send the exact amount shown on the payment page, on the network it names; underpayments are held until resolved.</p>
      ) : null}
    </fieldset>
  );
}
