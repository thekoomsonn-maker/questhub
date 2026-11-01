"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";
import { reportSchema } from "@/lib/validation";
import { log } from "@/lib/log";

const id = z.uuid();

export async function contactSeller(listingId: string, slug: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/listing/${slug}`)}`);
  if (!id.safeParse(listingId).success) return { ok: false, error: "Listing not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_listing: listingId });
  if (error) return { ok: false, error: friendlyError(error) };
  redirect(`/messages/${data}`);
}

/** Phone is only returned if the seller opted in; RLS enforces this too. */
export async function revealPhone(listingId: string): Promise<ActionResult<{ phone: string | null; whatsapp: string | null }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to see the seller's number." };
  if (!id.safeParse(listingId).success) return { ok: false, error: "Listing not found." };
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("seller_id").eq("id", listingId).single();
  if (!listing) return { ok: false, error: "Listing not found." };
  const { data } = await supabase
    .from("profile_contacts")
    .select("phone,whatsapp,show_phone")
    .eq("user_id", listing.seller_id)
    .maybeSingle();
  if (!data?.show_phone || !data.phone) return { ok: false, error: "This seller prefers to be contacted by message." };
  await supabase.rpc("record_listing_event", { p_listing: listingId, p_kind: "contact" });
  return { ok: true, data: { phone: data.phone, whatsapp: data.whatsapp } };
}

export async function recordView(listingId: string) {
  if (!id.safeParse(listingId).success) return;
  const supabase = await createClient();
  await supabase.rpc("record_listing_event", { p_listing: listingId, p_kind: "view" });
}

export async function submitReport(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to report." };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a reason for the report." };
  const { targetType, targetId, reason, details } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: viewer.id,
    target_type: targetType,
    listing_id: targetType === "listing" ? targetId : null,
    reported_user_id: targetType === "user" ? targetId : null,
    message_id: targetType === "message" ? targetId : null,
    reason,
    details: details || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You've already reported this. Our team is looking at it." };
    return { ok: false, error: friendlyError(error) };
  }
  log.info("report.created", { targetType, reason });
  return { ok: true, message: "Thanks. Our moderators will review this." };
}

export async function blockUser(userId: string, block: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (!id.safeParse(userId).success || userId === viewer.id) return { ok: false, error: "Can't block this user." };
  const supabase = await createClient();
  const { error } = block
    ? await supabase.from("user_blocks").upsert({ blocker_id: viewer.id, blocked_id: userId }, { ignoreDuplicates: true })
    : await supabase.from("user_blocks").delete().eq("blocker_id", viewer.id).eq("blocked_id", userId);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, message: block ? "User blocked. They can't message you." : "User unblocked." };
}
