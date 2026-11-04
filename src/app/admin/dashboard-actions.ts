"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";
import { fieldErrors } from "@/lib/validation";

// ---------------------------------------------------------------- Banners

const banner = z.object({
  placement: z.enum(["home", "store"]),
  title: z.string().trim().min(3, "Use at least 3 characters").max(80, "Keep it under 80 characters"),
  body: z.string().trim().max(200, "Keep it under 200 characters"),
  linkUrl: z.string().trim().max(300)
    .refine((v) => v === "" || /^\/[^/]/.test(v) || /^https:\/\//.test(v), "Use a page on this site (starting with /) or an https:// link"),
  linkLabel: z.string().trim().max(30, "Keep the button text short"),
  tone: z.enum(["brand", "gold", "ink"]),
  startsAt: z.string().trim(),
  endsAt: z.string().trim(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
}).refine((v) => (v.linkUrl === "") === (v.linkLabel === ""), { path: ["linkLabel"], message: "Add both a link and its button text, or neither" })
  .refine((v) => !v.endsAt || !v.startsAt || new Date(v.endsAt) > new Date(v.startsAt), { path: ["endsAt"], message: "End must be after the start" });

export type BannerInput = z.input<typeof banner>;

/** datetime-local values are Accra time (UTC+0), so append Z. */
const toIso = (v: string) => (v ? new Date(v.length === 16 ? `${v}:00Z` : v).toISOString() : null);

export async function saveBanner(id: string | null, input: BannerInput): Promise<ActionResult> {
  const { id: userId } = await requireStaff("commerce");
  const parsed = banner.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const row = {
    placement: d.placement, title: d.title, body: d.body || null,
    link_url: d.linkUrl || null, link_label: d.linkLabel || null, tone: d.tone,
    starts_at: toIso(d.startsAt) ?? new Date().toISOString(), ends_at: toIso(d.endsAt),
    is_active: d.isActive, sort_order: d.sortOrder,
  };
  const supabase = await createClient();
  const { error } = id && z.uuid().safeParse(id).success
    ? await supabase.from("site_banners").update(row).eq("id", id)
    : await supabase.from("site_banners").insert({ ...row, created_by: userId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/banners");
  revalidatePath("/");
  revalidatePath("/store");
  return { ok: true, message: id ? "Banner saved." : "Banner created." };
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  await requireStaff("commerce");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Banner not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("site_banners").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/banners");
  revalidatePath("/");
  revalidatePath("/store");
  return { ok: true, message: "Banner deleted." };
}

// ---------------------------------------------------------------- Staff

const level = z.enum(["owner", "manager", "moderator"]);

export async function addStaff(email: string, staffLevel: string, reason: string): Promise<ActionResult> {
  await requireStaff("owner");
  const e = z.email().safeParse(email.trim());
  const l = level.safeParse(staffLevel);
  if (!e.success) return { ok: false, error: "Enter the email they use to sign in to QuestHub." };
  if (!l.success) return { ok: false, error: "Choose a staff role." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_find_user_by_email", { p_email: e.data });
  if (error) return { ok: false, error: friendlyError(error) };
  const user = data?.[0];
  if (!user) return { ok: false, error: "No QuestHub account uses that email. Ask them to sign up first, then add them here." };
  const { error: setError } = await supabase.rpc("admin_set_staff", { p_user: user.id, p_level: l.data, p_reason: reason.trim().slice(0, 300) || undefined });
  if (setError) return { ok: false, error: friendlyError(setError) };
  revalidatePath("/admin/staff");
  return { ok: true, message: `${user.display_name} is now a ${l.data}.` };
}

export async function changeStaff(userId: string, staffLevel: string | null, reason: string): Promise<ActionResult> {
  await requireStaff("owner");
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: "User not found." };
  const l = staffLevel === null ? null : level.safeParse(staffLevel);
  if (l && !l.success) return { ok: false, error: "Choose a staff role." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_staff", { p_user: userId, p_level: (l ? l.data : null) as "owner", p_reason: reason.trim().slice(0, 300) || undefined });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin/staff");
  return { ok: true, message: l ? "Staff role updated." : "Removed from staff." };
}
