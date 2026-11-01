import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { cryptoMode, hubtel, paymentsMode } from "./config";
import { hubtelCheckout, hubtelTopup, nowpaymentsApi, testTopup, type CryptoPayment, type Verification } from "./providers";

export type PaymentMethod = "mobile_money_card" | "crypto";

/**
 * All payment state changes happen here, with the service role, after the
 * provider has been asked directly. Browser redirects and callbacks only
 * trigger verification; they never mark anything paid on their own.
 */

function newReference(orderNumber: string) {
  // Hubtel allows up to 32 characters
  return `${orderNumber}-${randomBytes(5).toString("hex")}`.slice(0, 32);
}

/** GH₵ per US$1 from admin settings, or null if crypto pricing isn't set up. */
export async function cryptoRate(): Promise<number | null> {
  const { data } = await createServiceClient().from("platform_settings").select("value").eq("key", "crypto_usd_rate").single();
  const rate = Number(data?.value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export async function startCheckout(orderId: string, userId: string, email?: string, method: PaymentMethod = "mobile_money_card"): Promise<{ url: string }> {
  const mode = method === "crypto" ? cryptoMode() : paymentsMode();
  if (mode === "off") throw new Error(method === "crypto" ? "Crypto payments aren't available." : "Online payment isn't available yet.");
  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).eq("user_id", userId).single();
  if (!order) throw new Error("Order not found.");
  if (order.status !== "pending_payment" || ["paid", "test"].includes(order.payment_status)) throw new Error("This order doesn't need payment.");
  if (new Date(order.expires_at) < new Date()) throw new Error("This order expired. Place it again.");

  const reference = newReference(order.order_number);
  let usd: { amount: number; rate: number } | null = null;
  if (method === "crypto") {
    const rate = await cryptoRate();
    if (!rate) throw new Error("Crypto payments aren't available right now.");
    // Round up to the cent so the invoice never undercharges
    usd = { amount: Math.ceil((Number(order.total) / rate) * 100) / 100, rate };
    if (usd.amount < 1) throw new Error("Crypto payments need an order of at least US$1.");
  }
  const { error } = await db.from("payments").insert({
    user_id: userId, purpose: "order", order_id: order.id, method,
    provider: mode !== "live" ? "test" : method === "crypto" ? "nowpayments" : "hubtel",
    reference, amount: order.total, currency: order.currency, status: "pending",
    provider_amount: usd?.amount ?? null, provider_currency: usd ? "USD" : null, fx_rate: usd?.rate ?? null,
  });
  if (error) throw new Error("Couldn't start payment. Try again.");
  await db.from("orders").update({ payment_status: "pending" }).eq("id", order.id).in("payment_status", ["unpaid", "failed"]);

  if (mode === "test") return { url: `/checkout/test/${encodeURIComponent(reference)}` };

  const base = env.siteUrl;
  if (method === "crypto" && usd) {
    const session = await nowpaymentsApi.createInvoice({
      reference,
      amountUsd: usd.amount,
      description: `QuestHub order ${order.order_number}`,
      successUrl: `${base}/orders/${order.id}?return=1`,
      cancelUrl: `${base}/orders/${order.id}?cancelled=1`,
      ipnUrl: `${base}/api/payments/nowpayments/ipn`,
    });
    await db.from("payments").update({ checkout_id: session.checkoutId }).eq("reference", reference);
    return { url: session.checkoutUrl };
  }
  const token = hubtel().callbackToken;
  const session = await hubtelCheckout.create({
    reference,
    amount: Number(order.total),
    description: order.kind === "topup" ? `${order.topup_type} for ${order.topup_recipient}` : `QuestHub order ${order.order_number}`,
    returnUrl: `${base}/orders/${order.id}?return=1`,
    cancelUrl: `${base}/orders/${order.id}?cancelled=1`,
    callbackUrl: `${base}/api/payments/hubtel/callback${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    customer: { name: order.delivery_name ?? undefined, phone: order.delivery_phone ?? undefined, email },
  });
  await db.from("payments").update({ checkout_id: session.checkoutId }).eq("reference", reference);
  return { url: session.checkoutUrl };
}

/** Records the verification and applies it to the order. Safe to call repeatedly. */
export async function applyVerification(reference: string, v: Verification, eventId: string) {
  const db = createServiceClient();
  const { data: payment } = await db.from("payments").select("*").eq("reference", reference).single();
  if (!payment) return { ok: false as const, reason: "unknown reference" };

  const after = v.status === "paid" ? (payment.provider === "test" ? "test" : "paid") : v.status === "failed" ? "failed" : "pending";
  const { error: eventError } = await db.from("payment_events").insert({
    payment_id: payment.id, provider: payment.provider, provider_event_id: eventId, event_type: `verify.${v.status}`,
    status_before: payment.status, status_after: after, payload: (v.raw ?? {}) as never,
  });
  if (eventError?.code === "23505") return { ok: true as const, duplicate: true }; // already processed this event

  if (v.status === "paid") {
    // Compare in the currency the provider was asked to charge (USD for crypto invoices)
    const expected = Number(payment.provider_amount ?? payment.amount);
    if (v.amount !== null && Math.abs(v.amount - expected) > 0.009) {
      log.error("payment.amount_mismatch", { reference, expected, got: v.amount });
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return { ok: false as const, reason: "amount mismatch" };
    }
    if (!["paid", "test"].includes(payment.status)) {
      await db.from("payments").update({
        status: after as "paid" | "test", verified_at: new Date().toISOString(),
        provider_transaction_id: v.providerTransactionId, channel: v.channel,
      }).eq("id", payment.id);
    }
    if (payment.order_id) {
      const { data: order, error } = await db.rpc("confirm_order_payment", {
        p_order: payment.order_id, p_amount: Number(payment.amount), p_payment_status: after as "paid" | "test",
      });
      if (error) {
        log.error("payment.confirm_failed", { reference, code: error.code });
        return { ok: false as const, reason: "confirm failed" };
      }
      if (order?.kind === "topup" && order.topup_status === "sending") await fulfilTopup(order.id);
    }
  } else if (v.status === "failed" && payment.status === "pending") {
    await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    if (payment.order_id) await db.rpc("record_payment_failure", { p_order: payment.order_id, p_reason: "Payment not completed" });
  }
  return { ok: true as const };
}

/** Verifies the latest pending payment for an order (used on the return page). */
export async function refreshOrderPayment(orderId: string) {
  if (paymentsMode() !== "live" && cryptoMode() !== "live") return;
  const db = createServiceClient();
  // Crypto: only checkable once NOWPayments has told us the payment id
  const { data: crypto } = await db.from("payments").select("provider_payment_id")
    .eq("order_id", orderId).eq("provider", "nowpayments").eq("status", "pending").not("provider_payment_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (crypto?.provider_payment_id) {
    try {
      await applyCryptoStatus(await nowpaymentsApi.getPayment(crypto.provider_payment_id));
    } catch (e) {
      log.warn("crypto.refresh_failed", { orderId, error: e instanceof Error ? e.message : "unknown" });
    }
  }
  const { data: payment } = await db.from("payments").select("reference,status,provider")
    .eq("order_id", orderId).eq("provider", "hubtel").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!payment) return;
  try {
    const v = await hubtelCheckout.verify(payment.reference);
    if (v.status !== "pending") await applyVerification(payment.reference, v, `status-check:${payment.reference}:${v.status}`);
  } catch (e) {
    log.warn("payment.refresh_failed", { orderId, error: e instanceof Error ? e.message : "unknown" });
  }
}

export async function fulfilTopup(orderId: string) {
  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.kind !== "topup" || order.topup_status !== "sending") return;
  const provider = order.payment_status === "test" ? testTopup : hubtelTopup;
  const token = hubtel().callbackToken;
  const result = await provider.send({
    network: order.topup_network!, type: order.topup_type as "airtime" | "data", recipient: order.topup_recipient!,
    amount: Number(order.total), providerCode: order.topup_provider_code, reference: `${order.order_number}-${order.topup_attempts + 1}`,
    callbackUrl: `${env.siteUrl}/api/topups/hubtel/callback${token ? `?token=${encodeURIComponent(token)}` : ""}`,
  });
  if (result.state === "pending") {
    if (result.providerReference) await db.from("orders").update({ topup_provider_reference: result.providerReference }).eq("id", orderId);
    return;
  }
  await db.rpc("record_topup_result", {
    p_order: orderId, p_delivered: result.state === "delivered", p_provider_reference: result.providerReference ?? undefined, p_error: result.error ?? undefined,
  });
}

/**
 * Applies a NOWPayments status that we fetched ourselves (never the raw
 * webhook body). Partial payments are held for staff review.
 */
export async function applyCryptoStatus(cp: CryptoPayment) {
  const db = createServiceClient();
  const { data: payment } = await db.from("payments").select("id,reference,provider,provider_currency,order_id,status").eq("reference", cp.orderReference).maybeSingle();
  if (!payment || payment.provider !== "nowpayments") return { ok: false as const, reason: "unknown reference" };
  await db.from("payments").update({ provider_payment_id: cp.paymentId, pay_currency: cp.payCurrency }).eq("id", payment.id);

  if (cp.priceCurrency !== (payment.provider_currency ?? "USD")) {
    log.error("crypto.currency_mismatch", { reference: payment.reference, got: cp.priceCurrency });
    return { ok: false as const, reason: "currency mismatch" };
  }
  if (cp.status === "partial") {
    const { error } = await db.from("payment_events").insert({
      payment_id: payment.id, provider: "nowpayments", provider_event_id: `nowpayments:${cp.paymentId}:partially_paid`,
      event_type: "verify.partial", status_before: payment.status, status_after: payment.status, payload: (cp.raw ?? {}) as never,
    });
    if (!error && payment.order_id) {
      await db.from("order_events").insert({ order_id: payment.order_id, status: "payment_partial", note: `Customer underpaid in ${cp.payCurrency ?? "crypto"}. Resolve in the NOWPayments dashboard (refund or request the difference).` });
    }
    return { ok: true as const };
  }
  if (cp.status === "pending") return { ok: true as const };
  return applyVerification(
    payment.reference,
    { status: cp.status, amount: cp.priceAmount, providerTransactionId: cp.paymentId, channel: `crypto:${cp.payCurrency ?? "unknown"}`, raw: cp.raw },
    `nowpayments:${cp.paymentId}:${cp.rawStatus}`,
  );
}
