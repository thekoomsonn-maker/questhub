"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { startCheckout } from "@/lib/payments/service";
import { paymentsMode } from "@/lib/payments/config";
import { friendlyError, type ActionResult } from "@/lib/utils";
import { ghanaPhone } from "@/lib/validation";
import { log } from "@/lib/log";

const deliverySchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: ghanaPhone.refine((v) => v !== "", "Enter a phone number for the rider"),
  regionId: z.coerce.number().int().min(1, "Choose a region").max(16),
  city: z.string().trim().min(2, "Enter the town or area").max(80),
  address: z.string().trim().min(5, "Add a street, landmark or GhanaPost GPS address").max(300),
  notes: z.string().trim().max(500).optional(),
});

async function pay(orderId: string, userId: string, email?: string): Promise<never> {
  let url: string;
  try {
    url = (await startCheckout(orderId, userId, email)).url;
  } catch (e) {
    log.warn("checkout.start_failed", { orderId, error: e instanceof Error ? e.message : "unknown" });
    redirect(`/orders/${orderId}?payment=unavailable`);
  }
  redirect(url);
}

export async function placeGoodsOrder(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Your session expired. Sign in again." };
  if (paymentsMode() === "off") return { ok: false, error: "Online payment isn't available yet. Please check back soon." };
  const parsed = deliverySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Check the delivery details.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("place_goods_order", {
    p_name: d.name, p_phone: d.phone, p_region: d.regionId, p_city: d.city, p_address: d.address, p_notes: d.notes ?? "",
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return pay(orderId, viewer.id, viewer.email);
}

export async function payExistingOrder(orderId: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || !z.uuid().safeParse(orderId).success) redirect("/orders");
  await pay(orderId, viewer.id, viewer.email);
}

export async function cancelOrder(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_order", { p_order: orderId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "Order cancelled." };
}
