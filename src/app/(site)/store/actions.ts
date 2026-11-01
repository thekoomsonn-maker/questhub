"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";

const input = z.object({ productId: z.uuid(), quantity: z.number().int().min(0).max(20) });

/** Adds to (or sets) a cart line. Stock is re-checked at checkout inside the database. */
export async function setCartQuantity(productId: string, quantity: number, mode: "add" | "set" = "set"): Promise<ActionResult<{ count: number }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to add items to your cart." };
  const parsed = input.safeParse({ productId, quantity });
  if (!parsed.success) return { ok: false, error: "Choose a quantity between 1 and 20." };
  const supabase = await createClient();

  const { data: product } = await supabase.from("store_products").select("stock,is_active,name").eq("id", productId).maybeSingle();
  if (!product?.is_active) return { ok: false, error: "This product isn't available any more." };

  let next = parsed.data.quantity;
  if (mode === "add") {
    const { data: line } = await supabase.from("cart_items").select("quantity").eq("user_id", viewer.id).eq("product_id", productId).maybeSingle();
    next = (line?.quantity ?? 0) + parsed.data.quantity;
  }
  if (next > product.stock) return { ok: false, error: product.stock ? `Only ${product.stock} in stock.` : "Out of stock." };
  next = Math.min(next, 20);

  const { error } = next === 0
    ? await supabase.from("cart_items").delete().eq("user_id", viewer.id).eq("product_id", productId)
    : await supabase.from("cart_items").upsert({ user_id: viewer.id, product_id: productId, quantity: next }, { onConflict: "user_id,product_id" });
  if (error) return { ok: false, error: friendlyError(error) };

  const { data: lines } = await supabase.from("cart_items").select("quantity").eq("user_id", viewer.id);
  revalidatePath("/", "layout");
  return { ok: true, data: { count: (lines ?? []).reduce((n, l) => n + l.quantity, 0) }, message: mode === "add" ? `${product.name} added to your cart.` : undefined };
}
