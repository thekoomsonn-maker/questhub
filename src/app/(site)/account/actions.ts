"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { fieldErrors, profileSchema } from "@/lib/validation";
import { friendlyError, type ActionResult } from "@/lib/utils";

export async function updateProfile(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = profileSchema.safeParse({
    displayName: form.get("displayName"),
    username: form.get("username") ?? "",
    bio: form.get("bio") ?? "",
    regionId: form.get("regionId") || null,
    city: form.get("city") ?? "",
    phone: form.get("phone") ?? "",
    whatsapp: form.get("whatsapp") ?? "",
    showPhone: form.get("showPhone") === "on",
    emailNotifications: form.get("emailNotifications") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: d.displayName,
      username: d.username,
      bio: d.bio || null,
      region_id: d.regionId,
      city: d.city || null,
    })
    .eq("id", viewer.id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That username is taken.", fieldErrors: { username: ["That username is taken"] } };
    return { ok: false, error: friendlyError(error) };
  }

  const { error: contactError } = await supabase
    .from("profile_contacts")
    .update({
      phone: d.phone || null,
      whatsapp: d.whatsapp || null,
      show_phone: d.showPhone && Boolean(d.phone),
      email_notifications: d.emailNotifications,
    })
    .eq("user_id", viewer.id);
  if (contactError) return { ok: false, error: friendlyError(contactError) };

  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

/** Saves an avatar path after the browser uploads the file to storage. */
export async function setAvatar(path: string | null): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (path !== null && !path.startsWith(`${viewer.id}/`)) return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const previous = viewer.profile.avatar_path;
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error) };
  if (previous && previous !== path) await supabase.storage.from("avatars").remove([previous]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function becomeSeller(): Promise<void> {
  await requireViewer("/sell");
  const supabase = await createClient();
  const { error } = await supabase.rpc("become_seller");
  if (error) throw new Error(friendlyError(error));
  revalidatePath("/", "layout");
  redirect("/seller-dashboard/listings/new");
}

/** Records a deletion request; staff complete it after checking open reports. */
export async function requestAccountDeletion(): Promise<ActionResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/account");
  return { ok: true };
}

export async function cancelAccountDeletion(): Promise<ActionResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ deletion_requested_at: null }).eq("id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/account");
  return { ok: true };
}
