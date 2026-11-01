"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate } from "@/lib/format";
import { cancelAccountDeletion, requestAccountDeletion } from "./actions";

export function DeletionControls({ requestedAt }: { requestedAt: string | null }) {
  if (requestedAt) {
    return (
      <div className="flex items-center gap-3 text-sm text-ink-soft">
        <span>Deletion requested on {formatDate(requestedAt)}.</span>
        <Button
          variant="link"
          onClick={async () => {
            const r = await cancelAccountDeletion();
            if (r.ok) toast.success("Deletion request cancelled.");
            else toast.error(r.error);
          }}
        >
          Cancel request
        </Button>
      </div>
    );
  }
  return (
    <ConfirmDialog
      title="Delete your account?"
      body="We'll remove your profile, listings, saved items and messages within 30 days. Records we must keep for fraud investigations are retained as described in the privacy policy."
      confirmLabel="Request deletion"
      onConfirm={async () => {
        const r = await requestAccountDeletion();
        if (r.ok) toast.success("Deletion requested. You can cancel it any time before it's processed.");
        return r;
      }}
      trigger={(open) => (
        <Button variant="link" className="text-danger" onClick={open}>
          Delete account
        </Button>
      )}
    />
  );
}
