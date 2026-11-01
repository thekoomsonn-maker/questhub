import "server-only";
import { basicAuth, hubtel } from "./config";
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

/** Hubtel Online Checkout (redirect). */
export const hubtelCheckout = {
  async create(req: CheckoutRequest): Promise<CheckoutSession> {
    const h = hubtel();
    const r = await fetchJson(h.checkoutUrl, {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify({
        totalAmount: req.amount,
        description: req.description.slice(0, 100),
        callbackUrl: req.callbackUrl,
        returnUrl: req.returnUrl,
        cancellationUrl: req.cancelUrl,
        merchantAccountNumber: h.merchantAccount,
        clientReference: req.reference,
        payeeName: req.customer.name,
        payeeMobileNumber: req.customer.phone,
        payeeEmail: req.customer.email,
      }),
    });
    const data = (r.body?.data ?? {}) as Record<string, string>;
    if (!r.ok || r.body?.responseCode !== "0000" || !data.checkoutUrl) {
      log.error("hubtel.checkout_failed", { httpStatus: r.status, responseCode: r.body?.responseCode });
      throw new Error("The payment page couldn't be opened. Try again in a moment.");
    }
    return { checkoutUrl: data.checkoutUrl, checkoutId: data.checkoutId ?? null };
  },

  /** Server-side status check. Callbacks are not signed, so this is the source of truth. */
  async verify(reference: string): Promise<Verification> {
    const h = hubtel();
    const url = `${h.statusUrl.replace("{merchant}", encodeURIComponent(h.merchantAccount))}?clientReference=${encodeURIComponent(reference)}`;
    const r = await fetchJson(url, { headers: { Authorization: basicAuth(), Accept: "application/json" } });
    const data = (r.body?.data ?? {}) as Record<string, unknown>;
    const s = String(data.status ?? "").toLowerCase();
    if (!r.ok) log.warn("hubtel.status_check_failed", { httpStatus: r.status, responseCode: r.body?.responseCode });
    return {
      status: s === "paid" || s === "success" ? "paid" : s === "unpaid" || s === "failed" || s === "cancelled" ? "failed" : "pending",
      amount: typeof data.amount === "number" ? data.amount : data.amount ? Number(data.amount) : null,
      providerTransactionId: (data.transactionId ?? data.externalTransactionId ?? null) as string | null,
      channel: (data.paymentMethod ?? data.channel ?? null) as string | null,
      raw: r.body,
    };
  },
};

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
