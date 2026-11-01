"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";

export async function requestPromotion(listingId: string, planId: string): Promise<ActionResult> {
  await requireSeller();
  if (!z.uuid().safeParse(listingId).success || !z.uuid().safeParse(planId).success) return { ok: false, error: "Choose a listing and a plan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_promotion", { p_listing: listingId, p_plan: planId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/seller-dashboard/promotions");
  return { ok: true, message: "Promotion requested." };
}

export async function cancelPromotion(promotionId: string): Promise<ActionResult> {
  await requireSeller();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_promotion", { p_promotion: promotionId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/seller-dashboard/promotions");
  return { ok: true, message: "Request cancelled." };
}
