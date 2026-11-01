"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getAttributesForCategory } from "@/lib/data/catalog";
import { normalizeAttributes, type AttributeDef } from "@/lib/listing-attributes";
import { fieldErrors, listingSchema, type ListingInput } from "@/lib/validation";
import { friendlyError, type ActionResult } from "@/lib/utils";
import { log } from "@/lib/log";

const uuid = z.uuid();

async function sellerContext() {
  const viewer = await getViewer();
  if (!viewer) return { error: "Sign in to manage listings." } as const;
  if (viewer.profile.status !== "active") return { error: "Your account is suspended." } as const;
  if (viewer.profile.role === "buyer") return { error: "Switch on selling first." } as const;
  return { viewer, supabase: await createClient() } as const;
}

/** Creates or updates a listing's content and attributes. Status is never set here. */
export async function saveListing(listingId: string | null, input: ListingInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const ctx = await sellerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { viewer, supabase } = ctx;

  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const defs = (await getAttributesForCategory(d.categoryId)) as AttributeDef[];
  const attrs = normalizeAttributes(defs, d.attributes);
  if (!attrs.ok) {
    return { ok: false, error: "Check the item details.", fieldErrors: Object.fromEntries(Object.entries(attrs.errors).map(([k, v]) => [`attr.${k}`, [v]])) };
  }

  const values = {
    category_id: d.categoryId,
    title: d.title,
    description: d.description,
    price: d.price,
    is_negotiable: d.isNegotiable,
    condition: d.condition,
    quantity: d.quantity,
    region_id: d.regionId,
    city: d.city,
  };

  let id = listingId;
  let slug: string;
  if (id) {
    if (!uuid.safeParse(id).success) return { ok: false, error: "Listing not found." };
    const { data, error } = await supabase.from("listings").update(values).eq("id", id).eq("seller_id", viewer.id).select("id,slug").maybeSingle();
    if (error) return { ok: false, error: friendlyError(error) };
    if (!data) return { ok: false, error: "Listing not found or you can't edit it." };
    slug = data.slug;
  } else {
    const { data, error } = await supabase.from("listings").insert({ ...values, seller_id: viewer.id, status: "draft" }).select("id,slug").single();
    if (error) return { ok: false, error: friendlyError(error) };
    id = data.id;
    slug = data.slug;
    log.info("listing.created", { listingId: id });
  }

  // Replace attribute values: delete those no longer present, upsert the rest.
  const keep = attrs.rows.map((r) => r.attribute_id);
  const del = supabase.from("listing_attribute_values").delete().eq("listing_id", id);
  const { error: delError } = keep.length ? await del.not("attribute_id", "in", `(${keep.join(",")})`) : await del;
  if (delError) return { ok: false, error: friendlyError(delError) };
  if (attrs.rows.length) {
    const { error } = await supabase
      .from("listing_attribute_values")
      .upsert(attrs.rows.map((r) => ({ ...r, listing_id: id! })), { onConflict: "listing_id,attribute_id" });
    if (error) return { ok: false, error: friendlyError(error) };
  }

  revalidatePath("/seller-dashboard/listings");
  return { ok: true, data: { id, slug } };
}

const imageSchema = z.array(
  z.object({ path: z.string().min(10).max(300), width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000) }),
).min(1).max(10);

/** Records photos the browser already uploaded under <uid>/<listingId>/. */
export async function addListingImages(listingId: string, images: z.input<typeof imageSchema>): Promise<ActionResult<{ id: string; storage_path: string }[]>> {
  const ctx = await sellerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const parsed = imageSchema.safeParse(images);
  if (!parsed.success || !uuid.safeParse(listingId).success) return { ok: false, error: "Invalid upload." };
  const prefix = `${ctx.viewer.id}/${listingId}/`;
  if (parsed.data.some((i) => !i.path.startsWith(prefix) || i.path.includes(".."))) return { ok: false, error: "Invalid upload." };

  const { count } = await ctx.supabase.from("listing_images").select("id", { count: "exact", head: true }).eq("listing_id", listingId);
  const { data, error } = await ctx.supabase
    .from("listing_images")
    .insert(parsed.data.map((img, i) => ({ listing_id: listingId, storage_path: img.path, width: img.width, height: img.height, sort_order: (count ?? 0) + i })))
    .select("id,storage_path");
  if (error) {
    await ctx.supabase.storage.from("listing-images").remove(parsed.data.map((i) => i.path));
    return { ok: false, error: friendlyError(error) };
  }
  revalidatePath("/seller-dashboard/listings");
  return { ok: true, data };
}

export async function removeListingImage(imageId: string): Promise<ActionResult> {
  const ctx = await sellerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  if (!uuid.safeParse(imageId).success) return { ok: false, error: "Photo not found." };
  const { data, error } = await ctx.supabase.from("listing_images").delete().eq("id", imageId).select("storage_path").maybeSingle();
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data) return { ok: false, error: "Photo not found." };
  await ctx.supabase.storage.from("listing-images").remove([data.storage_path]);
  return { ok: true };
}

/** Removes uploaded files that never made it into listing_images (failed save). */
export async function discardUploads(paths: string[]): Promise<void> {
  const ctx = await sellerContext();
  if ("error" in ctx) return;
  const own = paths.filter((p) => p.startsWith(`${ctx.viewer.id}/`)).slice(0, 20);
  if (own.length) await ctx.supabase.storage.from("listing-images").remove(own);
}

export async function reorderListingImages(listingId: string, imageIds: string[]): Promise<ActionResult> {
  const ctx = await sellerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  if (!uuid.safeParse(listingId).success || !z.array(uuid).max(10).safeParse(imageIds).success) return { ok: false, error: "Invalid order." };
  const results = await Promise.all(
    imageIds.map((id, i) => ctx.supabase.from("listing_images").update({ sort_order: i }).eq("id", id).eq("listing_id", listingId)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: friendlyError(failed.error) };
  return { ok: true };
}

type Status = "draft" | "pending_review" | "published" | "paused" | "sold";

/**
 * Status changes go through the database's transition rules, which decide
 * whether a submission needs review. We only report the outcome.
 */
export async function setListingStatus(listingId: string, status: Status, soldToBuyerId?: string | null): Promise<ActionResult<{ status: string }>> {
  const ctx = await sellerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  if (!uuid.safeParse(listingId).success) return { ok: false, error: "Listing not found." };
  if (soldToBuyerId && !uuid.safeParse(soldToBuyerId).success) return { ok: false, error: "Invalid buyer." };

  const { data, error } = await ctx.supabase
    .from("listings")
    .update({ status, ...(status === "sold" ? { sold_to_buyer_id: soldToBuyerId ?? null } : {}) })
    .eq("id", listingId)
    .eq("seller_id", ctx.viewer.id)
    .select("status,slug")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data) return { ok: false, error: "Listing not found." };

  revalidatePath("/seller-dashboard/listings");
  revalidatePath(`/listing/${data.slug}`);
  const message =
    data.status === "pending_review" ? "Submitted. We'll review it shortly and let you know." :
    data.status === "published" ? "Your listing is live." :
    data.status === "paused" ? "Listing paused. Buyers can't see it until you resume." :
    data.status === "sold" ? "Marked as sold." : "Saved as a draft.";
  return { ok: true, data: { status: data.status }, message };
}

export async function deleteListing(listingId: string): Promise<ActionResult> {
  const ctx = await sellerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  if (!uuid.safeParse(listingId).success) return { ok: false, error: "Listing not found." };
  const { data: images } = await ctx.supabase.from("listing_images").select("storage_path").eq("listing_id", listingId);
  const { data, error } = await ctx.supabase.from("listings").delete().eq("id", listingId).select("id");
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data?.length) return { ok: false, error: "Only drafts and listings that weren't approved can be deleted. Pause or mark it sold instead." };
  if (images?.length) await ctx.supabase.storage.from("listing-images").remove(images.map((i) => i.storage_path));
  revalidatePath("/seller-dashboard/listings");
  return { ok: true, message: "Listing deleted." };
}

export async function renewListing(listingId: string): Promise<ActionResult> {
  const ctx = await sellerContext();
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { error } = await ctx.supabase.rpc("renew_listing", { p_listing: listingId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/seller-dashboard/listings");
  return { ok: true, message: "Renewed for another 60 days." };
}
