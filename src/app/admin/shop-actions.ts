"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";

export async function setShopStatus(shopId: string, status: "pending" | "active" | "suspended", reason: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(shopId).success) return { ok: false, error: "Shop not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_shop_status", { p_shop: shopId, p_status: status, p_reason: reason });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/shops");
  return { ok: true, message: status === "active" ? "Shop approved." : "Shop updated." };
}

export async function setShopFlags(shopId: string, verified: boolean | null, featuredDays: number | null, reason: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_shop_flags", { p_shop: shopId, p_verified: verified ?? undefined, p_featured_days: featuredDays ?? undefined, p_reason: reason });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/shops");
  return { ok: true, message: "Shop updated." };
}
