import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, statusLabel } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { UserAvatar } from "@/components/user-avatar";
import { ReportButton } from "@/components/report-button";
import { BlockButton } from "../../seller/[id]/block-button";
import { getConversations } from "../data";
import { ConversationList } from "../conversation-list";
import { ChatThread } from "./chat-thread";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/messages/[conversationId]">) {
  const { conversationId } = await params;
  if (!z.uuid().safeParse(conversationId).success) notFound();
  const viewer = await requireViewer(`/messages/${conversationId}`);
  const supabase = await createClient();

  const all = await getConversations(viewer.id);
  const convo = all.find((c) => c.id === conversationId);
  if (!convo) notFound(); // RLS: non-participants get nothing

  const [{ data: messages }, { data: block }] = await Promise.all([
    supabase.from("messages").select("id,sender_id,kind,body,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(40),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewer.id).eq("blocked_id", convo.other?.id ?? "").maybeSingle(),
  ]);
  const otherLastRead = convo.selling ? convo.buyer_last_read_at : convo.seller_last_read_at;
  const listingCover = listingImageUrl(convo.cover);

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-[320px_1fr]">
      <aside className="hidden max-h-[calc(100vh-8rem)] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface md:block" aria-label="Conversations">
        <ConversationList items={all} activeId={conversationId} />
      </aside>
      <section className="flex h-[calc(100dvh-12rem)] min-h-[28rem] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface md:h-[calc(100vh-8rem)]">
        <header className="flex items-center gap-3 border-b border-line p-3">
          <Link href="/messages" className="rounded-full p-1.5 hover:bg-paper md:hidden" aria-label="Back to messages"><ChevronLeft size={20} /></Link>
          <UserAvatar name={convo.other?.display_name ?? "?"} path={convo.other?.avatar_path} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{convo.other?.display_name ?? "Deleted user"}</p>
            <p className="text-xs text-ink-faint">{convo.selling ? "Interested in your listing" : "Seller"}</p>
          </div>
          {convo.other ? (
            <div className="flex items-center gap-3">
              <ReportButton targetType="user" targetId={convo.other.id} signedIn label="Report user" compact />
              <BlockButton userId={convo.other.id} initial={Boolean(block)} />
            </div>
          ) : null}
        </header>
        {convo.listing ? (
          <Link href={`/listing/${convo.listing.slug}`} className="flex items-center gap-3 border-b border-line bg-paper px-3 py-2 hover:bg-brand-tint">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {listingCover ? <img src={listingCover} alt="" className="h-10 w-10 rounded-[6px] object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{convo.listing.title}</p>
              <p className="text-xs text-ink-soft"><span className="font-display font-bold tabular">{formatPrice(convo.listing.price, convo.listing.currency)}</span>{convo.listing.status !== "published" ? ` · ${statusLabel[convo.listing.status]}` : ""}</p>
            </div>
          </Link>
        ) : null}
        <ChatThread
          conversationId={conversationId}
          viewerId={viewer.id}
          initial={(messages ?? []).reverse()}
          otherLastRead={otherLastRead}
          disabled={convo.listing?.status === "removed" ? "This listing was removed, so the chat is closed." : null}
        />
      </section>
    </div>
  );
}
