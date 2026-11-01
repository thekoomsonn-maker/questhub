"use server";

import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { paymentsMode } from "@/lib/payments/config";
import { applyVerification } from "@/lib/payments/service";

/** Simulates the provider's answer in test mode, then goes through the same verification path as live payments. */
export async function simulatePayment(reference: string, outcome: "paid" | "failed") {
  if (paymentsMode() !== "test") throw new Error("Test payments are disabled");
  const viewer = await requireViewer();
  const { data: payment } = await createServiceClient().from("payments").select("user_id,amount,order_id,provider").eq("reference", reference).single();
  if (!payment || payment.user_id !== viewer.id || payment.provider !== "test") throw new Error("Payment not found");
  await applyVerification(reference, { status: outcome, amount: Number(payment.amount), providerTransactionId: `TEST-${reference}`, channel: "test", raw: { simulated: outcome } }, `test:${reference}:${outcome}`);
  redirect(`/orders/${payment.order_id}?return=1`);
}
