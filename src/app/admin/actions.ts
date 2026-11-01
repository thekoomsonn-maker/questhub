"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";

/**
 * Every action re-checks admin status here AND in the database function it
 * calls, which also writes the audit log entry.
 */
async function admin() {
  await requireAdmin();
  return createClient();
}

const id = z.uuid();
const reason = z.string().trim().max(500);

function done(error: { message?: string; code?: string } | null, paths: string[], message: string): ActionResult {
  if (error) return { ok: false, error: friendlyError(error) };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, message };
}

export async function moderateListing(listingId: string, action: "approve" | "reject" | "request_changes" | "remove" | "restore", why: string) {
  if (!id.safeParse(listingId).success) return { ok: false, error: "Listing not found." } as ActionResult;
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_moderate_listing", { p_listing: listingId, p_action: action, p_reason: reason.parse(why) });
  const labels = { approve: "Listing approved.", reject: "Listing rejected.", request_changes: "Changes requested.", remove: "Listing removed.", restore: "Listing restored." };
  return done(error, ["/admin/listings", "/admin"], labels[action]);
}

export async function setUserStatus(userId: string, status: "active" | "suspended", why: string) {
  if (!id.safeParse(userId).success) return { ok: false, error: "User not found." } as ActionResult;
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user: userId, p_status: status, p_reason: reason.parse(why) });
  return done(error, ["/admin/users"], status === "suspended" ? "Account suspended." : "Account reinstated.");
}

export async function setUserVerified(userId: string, verified: boolean, why: string) {
  if (!id.safeParse(userId).success) return { ok: false, error: "User not found." } as ActionResult;
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_verified", { p_user: userId, p_verified: verified, p_reason: reason.parse(why) });
  return done(error, ["/admin/users"], verified ? "Seller verified." : "Verification removed.");
}

export async function setUserRole(userId: string, role: "buyer" | "seller" | "admin", why: string) {
  if (!id.safeParse(userId).success) return { ok: false, error: "User not found." } as ActionResult;
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_user_role", { p_user: userId, p_role: role, p_reason: reason.parse(why) });
  return done(error, ["/admin/users"], "Role updated.");
}

export async function updateReport(reportId: string, status: "open" | "reviewing" | "resolved" | "dismissed", note: string) {
  if (!id.safeParse(reportId).success) return { ok: false, error: "Report not found." } as ActionResult;
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_update_report", { p_report: reportId, p_status: status, p_note: reason.parse(note) });
  return done(error, ["/admin/reports", "/admin"], `Report marked ${status}.`);
}

export async function readReportedMessage(reportId: string): Promise<ActionResult<{ body: string; created_at: string }>> {
  if (!id.safeParse(reportId).success) return { ok: false, error: "Report not found." };
  const supabase = await admin();
  const { data, error } = await supabase.rpc("admin_reported_message", { p_report: reportId });
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data?.[0]) return { ok: false, error: "The message was deleted." };
  return { ok: true, data: data[0] };
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  parentId: z.uuid().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
  icon: z.string().trim().max(40).nullable(),
});

export async function saveCategory(categoryId: string | null, input: z.input<typeof categorySchema>): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const d = parsed.data;
  const supabase = await admin();
  const row = { name: d.name, slug: d.slug, parent_id: d.parentId, sort_order: d.sortOrder, is_active: d.isActive, icon: d.icon };
  const { error } = categoryId
    ? await supabase.from("categories").update(row).eq("id", categoryId)
    : await supabase.from("categories").insert(row);
  if (error?.code === "23505") return { ok: false, error: "That slug is already used." };
  return done(error, ["/admin/categories", "/", "/categories"], categoryId ? "Category saved." : "Category created.");
}

const planSchema = z.object({
  price: z.coerce.number().min(0).max(100000),
  durationDays: z.coerce.number().int().min(1).max(90),
  isActive: z.boolean(),
});

export async function updatePlan(planId: string, input: z.input<typeof planSchema>): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success || !id.safeParse(planId).success) return { ok: false, error: "Check the plan values." };
  const supabase = await admin();
  const { error } = await supabase
    .from("promotion_plans")
    .update({ price: parsed.data.price, duration_days: parsed.data.durationDays, is_active: parsed.data.isActive })
    .eq("id", planId);
  return done(error, ["/admin/promotions"], "Plan updated.");
}

export async function activatePromotionTest(promotionId: string, why: string) {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_activate_promotion_test", { p_promotion: promotionId, p_reason: reason.parse(why) });
  return done(error, ["/admin/promotions"], "Promotion activated in test mode.");
}

export async function cancelPromotionAdmin(promotionId: string, why: string) {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_cancel_promotion", { p_promotion: promotionId, p_reason: reason.parse(why) });
  return done(error, ["/admin/promotions"], "Promotion cancelled.");
}

/** Settings are typed by their current JSON value so a typo can't change their kind. */
export async function updateSetting(key: string, raw: string): Promise<ActionResult> {
  const supabase = await admin();
  const { data: current } = await supabase.from("platform_settings").select("value").eq("key", key).single();
  if (!current) return { ok: false, error: "Unknown setting." };
  let value: unknown;
  try {
    if (typeof current.value === "boolean") value = raw === "true";
    else if (typeof current.value === "number") {
      value = Number(raw);
      if (!Number.isFinite(value as number) || (value as number) < 0) throw new Error();
    } else if (Array.isArray(current.value)) {
      value = raw.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 500);
    } else value = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That value isn't valid for this setting." };
  }
  const { error } = await supabase.from("platform_settings").update({ value: value as never }).eq("key", key);
  return done(error, ["/admin/settings"], "Setting saved.");
}
