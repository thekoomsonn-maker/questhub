import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";

/** Badge counts for the header and bottom nav. */
export const getViewerCounts = cache(async () => {
  const viewer = await getViewer();
  if (!viewer) return { unreadMessages: 0, unreadNotifications: 0 };
  const supabase = await createClient();
  const [messages, notifications] = await Promise.all([
    supabase.rpc("unread_conversation_count"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("type", "message"),
  ]);
  return { unreadMessages: messages.data ?? 0, unreadNotifications: notifications.count ?? 0 };
});

export async function getFavoriteIds(): Promise<Set<string>> {
  const viewer = await getViewer();
  if (!viewer) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", viewer.id);
  return new Set((data ?? []).map((f) => f.listing_id));
}
