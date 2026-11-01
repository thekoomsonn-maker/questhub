import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { getConversations } from "./data";
import { ConversationList } from "./conversation-list";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  const viewer = await requireViewer("/messages");
  const role = (await searchParams).role;
  const all = await getConversations(viewer.id);
  const items = role === "selling" ? all.filter((c) => c.selling) : role === "buying" ? all.filter((c) => !c.selling) : all;
  const tabs = [["", "All"], ["buying", "Buying"], ["selling", "Selling"]] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Messages" />
      <nav className="mb-4 flex gap-1.5" aria-label="Filter conversations">
        {tabs.map(([key, label]) => (
          <Link key={key} href={key ? `/messages?role=${key}` : "/messages"} aria-current={(role ?? "") === key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-sm", (role ?? "") === key ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft")}>{label}</Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={<MessageCircle size={32} />} title="No conversations yet" body="When you message a seller, or a buyer messages you, the chat appears here." action={<ButtonLink href="/search">Browse listings</ButtonLink>} />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <ConversationList items={items} />
        </div>
      )}
    </div>
  );
}
