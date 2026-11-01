"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";

type Status = "confirmed" | "out_for_delivery" | "ready_for_pickup" | "completed" | "declined" | "cancelled";

export async function vendorUpdateOrder(orderId: string, status: Status, note: string): Promise<ActionResult> {
  await requireSeller();
  const supabase = await createClient();
  const { error } = await supabase.rpc("vendor_update_order", { p_order: orderId, p_status: status, p_note: note.slice(0, 500) });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/seller-dashboard/orders");
  return { ok: true, message: "Order updated. The buyer has been notified." };
}

export async function vendorConfirmPayment(orderId: string): Promise<ActionResult> {
  await requireSeller();
  const supabase = await createClient();
  const { error } = await supabase.rpc("vendor_confirm_payment", { p_order: orderId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/seller-dashboard/orders");
  return { ok: true, message: "Payment marked as received." };
}
