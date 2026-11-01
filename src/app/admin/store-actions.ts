"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fulfilTopup } from "@/lib/payments/service";
import { friendlyError, type ActionResult } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().trim().min(3, "Name is too short").max(120),
  brand: z.string().trim().max(60).transform((v) => v || null),
  description: z.string().trim().min(20, "Describe the product in at least 20 characters").max(8000),
  categoryId: z.uuid().nullable().catch(null),
  price: z.coerce.number().positive("Enter a price"),
  compareAtPrice: z.union([z.literal(""), z.coerce.number().positive()]).transform((v) => (v === "" ? null : v)),
  stock: z.coerce.number().int().min(0).max(100000),
  sku: z.string().trim().max(60).transform((v) => v || null),
  warranty: z.string().trim().max(120).transform((v) => v || null),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(productId: string | null, input: ProductInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const d = parsed.data;
  if (d.compareAtPrice !== null && d.compareAtPrice <= d.price) return { ok: false, error: "The 'was' price must be higher than the selling price." };
  const row = {
    name: d.name, brand: d.brand, description: d.description, category_id: d.categoryId, price: d.price,
    compare_at_price: d.compareAtPrice, stock: d.stock, sku: d.sku, warranty: d.warranty, is_active: d.isActive, is_featured: d.isFeatured,
  };
  const supabase = await createClient();
  const res = productId
    ? await supabase.from("store_products").update(row).eq("id", productId).select("id").single()
    : await supabase.from("store_products").insert(row).select("id").single();
  if (res.error) return { ok: false, error: res.error.code === "23505" ? "That SKU is already used." : friendlyError(res.error) };
  revalidatePath("/admin/products");
  revalidatePath("/store");
  return { ok: true, data: { id: res.data.id }, message: productId ? "Product saved." : "Product created. Add photos next." };
}

export async function addProductImage(productId: string, path: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!z.uuid().safeParse(productId).success || !path.startsWith(`products/${productId}/`)) return { ok: false, error: "Invalid upload." };
  const supabase = await createClient();
  const { count } = await supabase.from("store_product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { data, error } = await supabase.from("store_product_images").insert({ product_id: productId, storage_path: path, sort_order: count ?? 0 }).select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/store");
  return { ok: true, data };
}

export async function removeProductImage(imageId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_product_images").delete().eq("id", imageId).select("storage_path").single();
  if (error) return { ok: false, error: friendlyError(error) };
  await supabase.storage.from("product-images").remove([data.storage_path]);
  return { ok: true };
}

export async function updateOrderStatus(orderId: string, status: "processing" | "shipped" | "delivered" | "cancelled" | "refund_due" | "refunded", note: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_order", { p_order: orderId, p_status: status, p_note: note });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/orders");
  return { ok: true, message: "Order updated." };
}

export async function retryTopup(orderId: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_retry_topup", { p_order: orderId, p_note: note });
  if (error) return { ok: false, error: error.message };
  await fulfilTopup(orderId);
  revalidatePath("/admin/orders");
  return { ok: true, message: "Retry sent. Check the order status." };
}

const bundleSchema = z.object({
  network: z.enum(["mtn", "telecel", "airteltigo"]),
  name: z.string().trim().min(2).max(60),
  validity: z.string().trim().max(40).transform((v) => v || null),
  price: z.coerce.number().positive("Enter a price"),
  providerCode: z.string().trim().min(1, "Enter the Hubtel bundle code").max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
});
export type BundleInput = z.input<typeof bundleSchema>;

export async function saveBundle(bundleId: string | null, input: BundleInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bundleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const d = parsed.data;
  const row = { network: d.network, name: d.name, validity: d.validity, price: d.price, provider_code: d.providerCode, sort_order: d.sortOrder, is_active: d.isActive };
  const supabase = await createClient();
  const { error } = bundleId ? await supabase.from("topup_bundles").update(row).eq("id", bundleId) : await supabase.from("topup_bundles").insert(row);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/bundles");
  revalidatePath("/airtime");
  return { ok: true, message: "Bundle saved." };
}
