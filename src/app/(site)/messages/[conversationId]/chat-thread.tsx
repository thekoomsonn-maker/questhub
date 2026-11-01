"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Check, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report-button";
import { cn } from "@/lib/utils";
import { loadOlderMessages, markConversationRead, sendMessage, type ChatMessage } from "../actions";

/**
 * Messages are persisted first (server action), then shown. Realtime delivers
 * the other person's messages; RLS ensures only participants receive them.
 */
export function ChatThread({
  conversationId,
  viewerId,
  initial,
  otherLastRead,
  disabled,
}: {
  conversationId: string;
  viewerId: string;
  initial: ChatMessage[];
  otherLastRead: string | null;
  disabled: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [hasMore, setHasMore] = useState(initial.length >= 40);
  const [draft, setDraft] = useState("");
  const [sending, startSend] = useTransition();
  const [loadingOlder, startOlder] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    void markConversationRead(conversationId).then(() => router.refresh());
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== viewerId) void markConversationRead(conversationId);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerId]);

  useLayoutEffect(() => {
    if (stick.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    startSend(async () => {
      const r = await sendMessage(conversationId, body);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDraft("");
      stick.current = true;
      setMessages((prev) => (prev.some((p) => p.id === r.data!.id) ? prev : [...prev, r.data!]));
    });
  }

  function older() {
    const first = messages[0];
    if (!first) return;
    startOlder(async () => {
      const r = await loadOlderMessages(conversationId, first.created_at);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      stick.current = false;
      const el = scroller.current;
      const prevHeight = el?.scrollHeight ?? 0;
      setMessages((prev) => [...r.data!, ...prev]);
      setHasMore(r.data!.length >= 30);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    });
  }

  return (
    <>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-live="polite"
        aria-label="Messages"
      >
        {hasMore ? (
          <div className="mb-3 text-center">
            <Button size="sm" variant="ghost" pending={loadingOlder} onClick={older}>Load earlier messages</Button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-soft">Say hello. Ask if it&apos;s still available, where to view it, or anything else.</p>
        ) : null}
        <ul className="flex flex-col gap-1.5">
          {messages.map((m, i) => {
            const day = formatDate(m.created_at);
            const showDay = i === 0 || day !== formatDate(messages[i - 1].created_at);
            const mine = m.sender_id === viewerId;
            const seen = mine && otherLastRead && new Date(otherLastRead) >= new Date(m.created_at);
            return (
              <li key={m.id} className="flex flex-col">
                {showDay ? <p className="my-2 text-center text-[11px] font-medium text-ink-faint">{day}</p> : null}
                {m.kind === "system" ? (
                  <p className="mx-auto my-1 rounded-full bg-paper px-3 py-1 text-xs text-ink-soft">{m.body}</p>
                ) : (
                  <div className={cn("group flex max-w-[80%] items-end gap-1", mine ? "self-end" : "self-start")}>
                    <div className={cn("rounded-[16px] px-3 py-2 text-[15px] leading-snug", mine ? "rounded-br-[4px] bg-brand text-white" : "rounded-bl-[4px] bg-paper text-ink")}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-white/70" : "text-ink-faint")}>
                        {formatTime(m.created_at)}
                        {mine ? (seen ? <CheckCheck size={12} aria-label="Read" /> : <Check size={12} aria-label="Sent" />) : null}
                      </p>
                    </div>
                    {!mine ? (
                      <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <ReportButton targetType="message" targetId={m.id} signedIn label="Report message" compact />
                      </span>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {disabled ? (
        <p className="border-t border-line p-3 text-center text-sm text-ink-soft">{disabled}</p>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => { e.preventDefault(); send(); }}
        >
          <label htmlFor="message" className="sr-only">Message</label>
          <textarea
            id="message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Write a message"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[var(--radius-field)] border border-line-strong bg-surface px-3 py-2.5 text-[15px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <Button type="submit" size="icon" pending={sending} disabled={!draft.trim()} aria-label="Send">
            {!sending ? <SendHorizontal size={18} /> : null}
          </Button>
        </form>
      )}
    </>
  );
}
