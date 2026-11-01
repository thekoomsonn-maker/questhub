"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/utils";

/** Admin action with confirmation and (optionally) a required reason for the audit log. */
export function AdminActionButton({
  label,
  title,
  body,
  confirmLabel,
  tone = "primary",
  requireReason = false,
  reasonLabel,
  variant = "secondary",
  action,
}: {
  label: string;
  title: string;
  body?: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  requireReason?: boolean;
  reasonLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  action: (reason: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      title={title}
      body={body}
      confirmLabel={confirmLabel ?? label}
      tone={tone}
      requireReason={requireReason}
      reasonLabel={reasonLabel}
      onConfirm={async (reason) => {
        const r = await action(reason);
        if (r.ok) {
          toast.success(r.message ?? "Done.");
          router.refresh();
        }
        return r.ok ? r : { ok: false, error: r.error };
      }}
      trigger={(open) => <Button size="sm" variant={variant} onClick={open}>{label}</Button>}
    />
  );
}
