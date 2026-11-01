"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/utils";

export async function toggleFavorite(listingId: string, save: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to save listings." };
  if (!z.uuid().safeParse(listingId).success) return { ok: false, error: "Listing not found." };

  const supabase = await createClient();
  const { error } = save
    ? await supabase.from("favorites").upsert(
        { user_id: viewer.id, listing_id: listingId },
        { onConflict: "user_id,listing_id", ignoreDuplicates: true },
      )
    : await supabase.from("favorites").delete().eq("user_id", viewer.id).eq("listing_id", listingId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/favorites");
  return { ok: true };
}
