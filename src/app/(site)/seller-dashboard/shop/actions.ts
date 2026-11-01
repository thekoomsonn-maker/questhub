"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";

const phone = z.string().trim().transform((v) => v.replace(/[\s-]/g, "")).refine((v) => v === "" || /^(\+233|0)[235]\d{8}$/.test(v), "Enter a Ghana number like 024 123 4567");

const shopSchema = z.object({
  name: z.string().trim().min(2, "Enter your shop name").max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,49}$/, "3–50 lowercase letters, numbers or hyphens"),
  tagline: z.string().trim().max(120),
  about: z.string().trim().max(2000),
  phone, whatsapp: phone,
  regionId: z.coerce.number().int().min(1, "Choose a region").max(16),
  city: z.string().trim().min(2, "Enter your town or area").max(80),
  address: z.string().trim().max(200),
  openingHours: z.string().trim().max(300),
  deliveryInfo: z.string().trim().max(500),
  acceptsPayOnDelivery: z.boolean(),
  acceptsMomo: z.boolean(),
  momoNumber: phone,
  momoName: z.string().trim().max(80),
}).refine((v) => v.acceptsPayOnDelivery || v.acceptsMomo, { path: ["acceptsPayOnDelivery"], message: "Accept at least one way to pay" })
  .refine((v) => !v.acceptsMomo || (v.momoNumber && v.momoName), { path: ["momoNumber"], message: "Add the MoMo number and the name registered on it" });

export type ShopInput = z.input<typeof shopSchema>;

const nullIfEmpty = (v: string) => (v === "" ? null : v);
const local = (v: string) => (v.startsWith("+233") ? `0${v.slice(4)}` : v);

export async function saveShop(input: ShopInput): Promise<ActionResult<{ slug: string }>> {
  const viewer = await requireSeller();
  const parsed = shopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  const d = parsed.data;
  const row = {
    name: d.name, slug: d.slug, tagline: nullIfEmpty(d.tagline), about: nullIfEmpty(d.about),
    phone: nullIfEmpty(d.phone), whatsapp: nullIfEmpty(d.whatsapp), region_id: d.regionId, city: d.city,
    address: nullIfEmpty(d.address), opening_hours: nullIfEmpty(d.openingHours), delivery_info: nullIfEmpty(d.deliveryInfo),
    accepts_pay_on_delivery: d.acceptsPayOnDelivery, accepts_momo: d.acceptsMomo,
    momo_number: d.acceptsMomo ? local(d.momoNumber) : null, momo_name: d.acceptsMomo ? d.momoName : null,
  };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("shops").select("id").eq("owner_id", viewer.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("shops").update(row).eq("id", existing.id)
    : await supabase.from("shops").insert({ ...row, owner_id: viewer.id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That shop address is taken.", fieldErrors: { slug: ["That shop address is taken"] } };
    return { ok: false, error: friendlyError(error) };
  }
  revalidatePath("/seller-dashboard/shop");
  revalidatePath(`/shop/${d.slug}`);
  return { ok: true, data: { slug: d.slug }, message: existing ? "Shop saved." : "Shop created." };
}

export async function setShopImage(kind: "logo" | "banner", path: string | null): Promise<ActionResult> {
  const viewer = await requireSeller();
  if (path && !path.startsWith(`${viewer.id}/shop-`)) return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("id,logo_path,banner_path").eq("owner_id", viewer.id).single();
  if (!shop) return { ok: false, error: "Save your shop details first." };
  const previous = kind === "logo" ? shop.logo_path : shop.banner_path;
  const { error } = await supabase.from("shops").update(kind === "logo" ? { logo_path: path } : { banner_path: path }).eq("id", shop.id);
  if (error) return { ok: false, error: friendlyError(error) };
  if (previous && previous !== path) await supabase.storage.from("avatars").remove([previous]);
  revalidatePath("/seller-dashboard/shop");
  return { ok: true };
}

export async function requestShopPromotion(planId: string): Promise<ActionResult> {
  await requireSeller();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_shop_promotion", { p_plan: planId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/seller-dashboard/promotions");
  return { ok: true, message: "Featured shop requested." };
}
