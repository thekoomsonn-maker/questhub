import type { Profile } from "@/lib/auth";

/**
 * Staff permissions. Mirrors public.staff_can() in the database, which is
 * what actually enforces them; this copy only decides what the admin UI shows.
 */
export type StaffLevel = "owner" | "manager" | "moderator";
export type StaffArea = "safety" | "commerce" | "insights" | "owner";

export const staffLevelLabel: Record<StaffLevel, string> = {
  owner: "Owner",
  manager: "Manager",
  moderator: "Moderator",
};

export const staffLevelDescription: Record<StaffLevel, string> = {
  owner: "Everything, including staff, settings and payments.",
  manager: "Store, orders, vendors, promotions, banners, categories, sales reports and moderation.",
  moderator: "Listings, reports, users and shops.",
};

export function staffLevelOf(profile: Pick<Profile, "role" | "status" | "staff_level">): StaffLevel | null {
  if (profile.role !== "admin" || profile.status !== "active") return null;
  return (profile.staff_level as StaffLevel | null) ?? "owner";
}

export function staffCan(level: StaffLevel | null, area: StaffArea): boolean {
  if (!level) return false;
  if (level === "owner") return true;
  if (level === "manager") return area !== "owner";
  return area === "safety";
}
