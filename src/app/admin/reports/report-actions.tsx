"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/format";
import { AdminActionButton } from "../action-button";
import { moderateListing, readReportedMessage, setUserStatus, updateReport } from "../actions";

export function ReportActions({ id, status, listingId, userId, hasMessage }: { id: string; status: string; listingId: string | null; userId: string | null; hasMessage: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ body: string; created_at: string } | null>(null);
  const [pending, start] = useTransition();
  const open = status === "open" || status === "reviewing";

  return (
    <div className="flex max-w-xs flex-col gap-2">
      {hasMessage ? (
        msg ? (
          <blockquote className="rounded-[8px] border border-line bg-paper p-2 text-xs">
            <p className="whitespace-pre-wrap">{msg.body}</p>
            <p className="mt-1 text-ink-faint">{formatDate(msg.created_at)} {formatTime(msg.created_at)}</p>
          </blockquote>
        ) : (
          <Button size="sm" variant="ghost" pending={pending} onClick={() => start(async () => {
            const r = await readReportedMessage(id);
            if (r.ok && r.data) setMsg(r.data); else if (!r.ok) toast.error(r.error);
          })}>Show reported message</Button>
        )
      ) : null}
      {open ? (
        <div className="flex flex-wrap gap-1.5">
          {status === "open" ? (
            <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => {
              const r = await updateReport(id, "reviewing", "");
              if (r.ok) router.refresh(); else toast.error(r.error);
            })}>Start review</Button>
          ) : null}
          {listingId ? <AdminActionButton label="Remove listing" tone="danger" title="Remove the reported listing?" requireReason reasonLabel="Policy reason (sent to the seller)" action={(r) => moderateListing(listingId, "remove", r)} /> : null}
          {userId ? <AdminActionButton label="Suspend user" tone="danger" title="Suspend this account?" body="They can't post, message or appear in search until reinstated." requireReason action={(r) => setUserStatus(userId, "suspended", r)} /> : null}
          <AdminActionButton label="Resolve" variant="primary" title="Mark as resolved" requireReason reasonLabel="What did you do?" action={(r) => updateReport(id, "resolved", r)} />
          <AdminActionButton label="Dismiss" variant="ghost" title="Dismiss this report?" requireReason reasonLabel="Why no action is needed" action={(r) => updateReport(id, "dismissed", r)} />
        </div>
      ) : (
        <AdminActionButton label="Reopen" variant="ghost" title="Reopen this report?" action={(r) => updateReport(id, "open", r)} />
      )}
    </div>
  );
}
