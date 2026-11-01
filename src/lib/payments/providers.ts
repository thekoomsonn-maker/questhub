import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { basicAuth, hubtel, nowpayments, paystack } from "./config";
import { log } from "@/lib/log";

export type CheckoutRequest = {
  reference: string;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  customer: { name?: string; phone?: string; email?: string };
};
export type CheckoutSession = { checkoutUrl: string; checkoutId: string | null };
export type Verification = {
  status: "paid" | "pending" | "failed";
  amount: number | null;
  providerTransactionId: string | null;
  channel: string | null;
  raw: unknown;
};

async function fetchJson(url: string, init: RequestInit, timeoutMs = 20_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { nonJson: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, body: body as Record<string, unknown> | null };
}

/** Paystack hosted checkout (Mobile Money and cards). Amounts are sent in pesewas. */
export const paystackCheckout = {
  async create(req: CheckoutRequest): Promise<CheckoutSession> {
    const p = paystack();
    if (!req.customer.email) throw new Error("Add an email address to your account to pay online.");
    const r = await fetchJson(`${p.baseUrl}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: req.customer.email,
        amount: Math.round(req.amount * 100),
        currency: p.currency,
        reference: req.reference,
        callback_url: req.returnUrl,
        channels: ["mobile_money", "card", "bank_transfer"],
        metadata: {
          cancel_action: req.cancelUrl,
          description: req.description.slice(0, 100),
          custom_fields: [{ display_name: "Order", variable_name: "order", value: req.description.slice(0, 100) }],
        },
      }),
    });
    const data = (r.body?.data ?? {}) as Record<string, string>;
    if (!r.ok || r.body?.status !== true || !data.authorization_url) {
      log.error("paystack.initialize_failed", { httpStatus: r.status, message: String(r.body?.message ?? "").slice(0, 120) });
      throw new Error("The payment page couldn't be opened. Try again in a moment.");
    }
    return { checkoutUrl: data.authorization_url, checkoutId: data.access_code ?? null };
  },

  /** Server-side status check: the only thing that can mark a payment paid. */
  async verify(reference: string): Promise<Verification> {
    const p = paystack();
    const r = await fetchJson(`${p.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${p.secretKey}`, Accept: "application/json" },
    });
    const data = (r.body?.data ?? {}) as Record<string, unknown>;
    if (!r.ok) log.warn("paystack.verify_failed", { httpStatus: r.status });
    const s = String(data.status ?? "").toLowerCase();
    const currencyOk = String(data.currency ?? p.currency).toUpperCase() === p.currency.toUpperCase();
    return {
      status: s === "success" && currencyOk ? "paid" : s === "failed" || s === "abandoned" || s === "reversed" || (s === "success" && !currencyOk) ? "failed" : "pending",
      amount: typeof data.amount === "number" ? data.amount / 100 : null,
      providerTransactionId: data.id != null ? String(data.id) : null,
      channel: (data.channel as string) ?? null,
      raw: r.body,
    };
  },
};

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export type TopupRequest = {
  network: "mtn" | "telecel" | "airteltigo";
  type: "airtime" | "data";
  recipient: string;
  amount: number;
  providerCode: string | null;
  reference: string;
  callbackUrl: string;
};
export type TopupResult = { state: "delivered" | "pending" | "failed"; providerReference: string | null; error: string | null };

/** Hubtel commission services (airtime and data). */
export const hubtelTopup = {
  async send(req: TopupRequest): Promise<TopupResult> {
    const h = hubtel();
    const serviceId = h.serviceIds[req.network][req.type];
    if (!h.prepaidDepositId || !serviceId) {
      return { state: "failed", providerReference: null, error: `Hubtel ${req.network} ${req.type} service ID isn't configured` };
    }
    const url = h.topupUrl.replace("{deposit}", encodeURIComponent(h.prepaidDepositId)).replace("{service}", encodeURIComponent(serviceId));
    const body: Record<string, unknown> = {
      Destination: req.recipient,
      Amount: req.amount,
      CallbackUrl: req.callbackUrl,
      ClientReference: req.reference,
    };
    if (req.type === "data" && req.providerCode) body.Extradata = { bundle: req.providerCode };
    try {
      const r = await fetchJson(url, {
        method: "POST",
        headers: { Authorization: basicAuth(), "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      }, 30_000);
      const code = String(r.body?.ResponseCode ?? r.body?.responseCode ?? "");
      const data = (r.body?.Data ?? r.body?.data ?? {}) as Record<string, unknown>;
      const ref = (data.TransactionId ?? data.transactionId ?? null) as string | null;
      if (code === "0000") return { state: "delivered", providerReference: ref, error: null };
      if (code === "0001") return { state: "pending", providerReference: ref, error: null };
      return { state: "failed", providerReference: ref, error: `Provider response ${code || r.status}: ${String(r.body?.Message ?? r.body?.message ?? "").slice(0, 120)}` };
    } catch (e) {
      // Network timeouts are ambiguous: the top-up may still have gone through.
      log.error("hubtel.topup_error", { reference: req.reference, error: e instanceof Error ? e.name : "unknown" });
      return { state: "pending", providerReference: null, error: "No response from provider; awaiting callback" };
    }
  },
};

/** Test-mode top-up: succeeds, except numbers ending 000 fail so the failure path can be tried. */
export const testTopup = {
  async send(req: TopupRequest): Promise<TopupResult> {
    if (req.recipient.endsWith("000")) return { state: "failed", providerReference: null, error: "Test mode: simulated network failure" };
    return { state: "delivered", providerReference: `TEST-${req.reference}`, error: null };
  },
};

// ---------------------------------------------------------------------------
// NOWPayments (crypto)
// ---------------------------------------------------------------------------

/** Recursively sorts object keys, matching NOWPayments' signature scheme. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as object).sort().map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]));
  }
  return value;
}

export function verifyNowpaymentsSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const expected = createHmac("sha512", secret).update(JSON.stringify(sortKeys(parsed))).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CryptoPayment = {
  paymentId: string;
  orderReference: string;
  status: "paid" | "pending" | "partial" | "failed";
  rawStatus: string;
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string | null;
  raw: unknown;
};

export function mapNowpaymentsStatus(s: string): CryptoPayment["status"] {
  if (s === "finished") return "paid";
  if (s === "partially_paid") return "partial";
  if (s === "failed" || s === "expired" || s === "refunded") return "failed";
  return "pending"; // waiting, confirming, confirmed, sending
}

export const nowpaymentsApi = {
  async createInvoice(req: { reference: string; amountUsd: number; description: string; successUrl: string; cancelUrl: string; ipnUrl: string }) {
    const n = nowpayments();
    const r = await fetchJson(`${n.baseUrl}/invoice`, {
      method: "POST",
      headers: { "x-api-key": n.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: req.amountUsd,
        price_currency: "usd",
        order_id: req.reference,
        order_description: req.description.slice(0, 100),
        ipn_callback_url: req.ipnUrl,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
      }),
    });
    const url = r.body?.invoice_url as string | undefined;
    if (!r.ok || !url) {
      log.error("nowpayments.invoice_failed", { httpStatus: r.status });
      throw new Error("The crypto payment page couldn't be opened. Try again or pay with Mobile Money.");
    }
    return { checkoutUrl: url, checkoutId: String(r.body?.id ?? "") || null };
  },

  /** Authoritative status straight from NOWPayments. */
  async getPayment(paymentId: string): Promise<CryptoPayment> {
    const n = nowpayments();
    const r = await fetchJson(`${n.baseUrl}/payment/${encodeURIComponent(paymentId)}`, { headers: { "x-api-key": n.apiKey } });
    if (!r.ok || !r.body) throw new Error(`NOWPayments status check failed (${r.status})`);
    const b = r.body;
    return {
      paymentId: String(b.payment_id ?? paymentId),
      orderReference: String(b.order_id ?? ""),
      status: mapNowpaymentsStatus(String(b.payment_status ?? "")),
      rawStatus: String(b.payment_status ?? ""),
      priceAmount: Number(b.price_amount),
      priceCurrency: String(b.price_currency ?? "").toUpperCase(),
      payCurrency: (b.pay_currency as string) ?? null,
      raw: b,
    };
  },
};
