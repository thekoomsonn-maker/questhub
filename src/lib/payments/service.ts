import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { hubtel, paymentsMode } from "./config";
import { hubtelCheckout, hubtelTopup, testTopup, type Verification } from "./providers";

/**
 * All payment state changes happen here, with the service role, after the
 * provider has been asked directly. Browser redirects and callbacks only
 * trigger verification; they never mark anything paid on their own.
 */

function newReference(orderNumber: string) {
  // Hubtel allows up to 32 characters
  return `${orderNumber}-${randomBytes(5).toString("hex")}`.slice(0, 32);
}

export async function startCheckout(orderId: string, userId: string, email?: string): Promise<{ url: string }> {
  const mode = paymentsMode();
  if (mode === "off") throw new Error("Online payment isn't available yet.");
  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).eq("user_id", userId).single();
  if (!order) throw new Error("Order not found.");
  if (order.status !== "pending_payment" || ["paid", "test"].includes(order.payment_status)) throw new Error("This order doesn't need payment.");
  if (new Date(order.expires_at) < new Date()) throw new Error("This order expired. Place it again.");

  const reference = newReference(order.order_number);
  const { error } = await db.from("payments").insert({
    user_id: userId, purpose: "order", order_id: order.id, provider: mode === "live" ? "hubtel" : "test",
    reference, amount: order.total, currency: order.currency, status: "pending",
  });
  if (error) throw new Error("Couldn't start payment. Try again.");
  await db.from("orders").update({ payment_status: "pending" }).eq("id", order.id).in("payment_status", ["unpaid", "failed"]);

  if (mode === "test") return { url: `/checkout/test/${encodeURIComponent(reference)}` };

  const base = env.siteUrl;
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
    if (v.amount !== null && Math.abs(v.amount - Number(payment.amount)) > 0.009) {
      log.error("payment.amount_mismatch", { reference, expected: payment.amount, got: v.amount });
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
  if (paymentsMode() !== "live") return;
  const db = createServiceClient();
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
