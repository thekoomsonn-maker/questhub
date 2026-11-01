import "server-only";
import { cryptoMode } from "./config";
import { cryptoRate } from "./service";
import type { PaymentMethodOption } from "@/components/store/payment-method";

export async function paymentOptions(): Promise<PaymentMethodOption> {
  if (cryptoMode() === "off") return { crypto: null };
  const rate = await cryptoRate();
  return { crypto: rate ? { usdRate: rate } : null };
}
