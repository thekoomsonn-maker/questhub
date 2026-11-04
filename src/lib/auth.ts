import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { staffCan, staffLevelOf, type StaffArea, type StaffLevel } from "@/lib/staff";

export type Profile = Tables<"profiles">;
export type Viewer = { id: string; email: string | undefined; profile: Profile };

/** Current signed-in user and profile, verified with Supabase Auth. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return null;
  return { id: user.id, email: user.email, profile };
});

/** Redirects to login if signed out. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return viewer;
}

/** Sends buyers to /sell to switch on selling first. */
export async function requireSeller(next?: string): Promise<Viewer> {
  const viewer = await requireViewer(next);
  if (viewer.profile.status !== "active") redirect("/account?suspended=1");
  if (viewer.profile.role === "buyer") redirect("/sell");
  return viewer;
}

/** Admin pages. The database re-checks every admin action independently. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer("/admin");
  if (viewer.profile.role !== "admin" || viewer.profile.status !== "active") redirect("/");
  return viewer;
}

/** Admin pages limited to one staff area; others are sent to the overview. */
export async function requireStaff(area: StaffArea): Promise<Viewer & { level: StaffLevel }> {
  const viewer = await requireAdmin();
  const level = staffLevelOf(viewer.profile)!;
  if (!staffCan(level, area)) redirect("/admin?denied=1");
  return { ...viewer, level };
}

export function isSafeRedirect(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\"));
}
