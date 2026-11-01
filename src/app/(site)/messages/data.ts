import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getConversations(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(`id,buyer_id,seller_id,last_message_at,last_message_preview,buyer_last_read_at,seller_last_read_at,
      listing:listings(id,slug,title,price,currency,status,images:listing_images(storage_path,sort_order)),
      buyer:profiles!conversations_buyer_id_fkey(id,display_name,avatar_path),
      seller:profiles!conversations_seller_id_fkey(id,display_name,avatar_path)`)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data.map((c) => {
    const selling = c.seller_id === viewerId;
    const lastRead = selling ? c.seller_last_read_at : c.buyer_last_read_at;
    return {
      ...c,
      selling,
      other: selling ? c.buyer : c.seller,
      unread: !lastRead || new Date(c.last_message_at) > new Date(lastRead),
      cover: c.listing ? [...c.listing.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null : null,
    };
  });
}
export type ConversationItem = Awaited<ReturnType<typeof getConversations>>[number];
