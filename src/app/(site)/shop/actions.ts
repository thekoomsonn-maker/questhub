"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { ghanaPhone } from "@/lib/validation";
import { friendlyError, type ActionResult } from "@/lib/utils";

export async function setShopCartQuantity(listingId: string, quantity: number, mode: "add" | "set" = "set"): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to order from shops." };
  if (!z.uuid().safeParse(listingId).success || !Number.isInteger(quantity) || quantity < 0 || quantity > 50) return { ok: false, error: "Choose a valid quantity." };
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("title,quantity,orderable,status,seller_id").eq("id", listingId).maybeSingle();
  if (!listing?.orderable || listing.status !== "published") return { ok: false, error: "This item can't be ordered online right now." };
  if (listing.seller_id === viewer.id) return { ok: false, error: "That's your own listing." };

  let next = quantity;
  if (mode === "add") {
    const { data: line } = await supabase.from("shop_cart_items").select("quantity").eq("user_id", viewer.id).eq("listing_id", listingId).maybeSingle();
    next = (line?.quantity ?? 0) + quantity;
  }
  if (next > listing.quantity) return { ok: false, error: listing.quantity ? `Only ${listing.quantity} available.` : "Sold out." };
  const { error } = next === 0
    ? await supabase.from("shop_cart_items").delete().eq("user_id", viewer.id).eq("listing_id", listingId)
    : await supabase.from("shop_cart_items").upsert({ user_id: viewer.id, listing_id: listingId, quantity: next }, { onConflict: "user_id,listing_id" });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: mode === "add" ? `${listing.title} added to your cart.` : undefined };
}

const orderSchema = z.object({
  shopId: z.uuid(),
  method: z.enum(["pay_on_delivery", "momo_to_vendor"], { error: "Choose how you'll pay" }),
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: ghanaPhone.refine((v) => v !== "", "Enter your phone number"),
  regionId: z.coerce.number().int().min(1).max(16).nullable().catch(null),
  city: z.string().trim().max(80),
  address: z.string().trim().max(300),
  note: z.string().trim().max(500),
});

export async function placeShopOrder(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Your session expired. Sign in again." };
  const parsed = orderSchema.safeParse({ ...Object.fromEntries(form), regionId: form.get("regionId") || null });
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("place_shop_order", {
    p_shop: d.shopId, p_payment: d.method, p_name: d.name, p_phone: d.phone, p_region: d.regionId ?? undefined, p_city: d.city, p_address: d.address, p_note: d.note,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  redirect(`/orders/shop/${orderId}?placed=1`);
}

export async function buyerVendorOrderAction(orderId: string, action: "cancel" | "mark_paid"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("buyer_update_vendor_order", { p_order: orderId, p_action: action });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/orders/shop/${orderId}`);
  return { ok: true, message: action === "cancel" ? "Order cancelled." : "Thanks. We told the shop you've paid." };
}
