import Link from "next/link";
import type { Metadata } from "next";
import { Bell, CheckCircle2, Megaphone, MessageCircle, ShieldAlert, UserCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { markAllRead, markRead } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

const icons: Record<string, typeof Bell> = { message: MessageCircle, moderation: ShieldAlert, promotion: Megaphone, account: UserCheck, report: CheckCircle2 };

export default async function NotificationsPage() {
  const viewer = await requireViewer("/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={unread ? <form action={markAllRead}><Button type="submit" variant="secondary" size="sm">Mark all as read</Button></form> : null}
      />
      {!data?.length ? (
        <EmptyState icon={<Bell size={32} />} title="No notifications yet" body="We'll let you know about new messages, listing reviews and account updates here." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {data.map((n) => {
            const Icon = icons[n.type] ?? Bell;
            return (
              <li key={n.id} className={cn("relative flex gap-3 p-4", !n.read_at && "bg-brand-tint/50")}>
                <Icon size={20} className={cn("mt-0.5 shrink-0", n.read_at ? "text-ink-faint" : "text-brand")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</p>
                  {n.body ? <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{n.body}</p> : null}
                  <p className="mt-1 text-xs text-ink-faint">{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {n.link ? <Link href={n.link} className="text-sm font-medium text-brand hover:underline">Open</Link> : null}
                  {!n.read_at ? (
                    <form action={markRead.bind(null, n.id)}><button className="text-xs text-ink-faint hover:text-ink">Mark read</button></form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
