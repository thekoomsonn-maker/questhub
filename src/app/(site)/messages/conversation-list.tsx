import Link from "next/link";
import { listingImageUrl } from "@/lib/images";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationItem } from "./data";

export function ConversationList({ items, activeId }: { items: ConversationItem[]; activeId?: string }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => {
        const img = listingImageUrl(c.cover);
        return (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} aria-current={c.id === activeId ? "page" : undefined}
              className={cn("flex gap-3 p-3 hover:bg-paper", c.id === activeId && "bg-brand-tint")}>
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img ? <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.other?.display_name ?? "Deleted user"}</p>
                  <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(c.last_message_at)}</span>
                </div>
                <p className="truncate text-xs text-ink-soft">{c.selling ? "Selling: " : "Buying: "}{c.listing?.title ?? "Listing removed"}</p>
                <p className={cn("truncate text-xs", c.unread ? "text-ink" : "text-ink-faint")}>{c.last_message_preview ?? "No messages yet"}</p>
              </div>
              {c.unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
