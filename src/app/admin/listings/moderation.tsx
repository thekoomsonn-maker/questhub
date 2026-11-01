"use client";

import { AdminActionButton } from "../action-button";
import { moderateListing } from "../actions";

export function ListingModeration({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "pending_review" || status === "rejected" ? (
        <AdminActionButton label="Approve" variant="primary" title="Approve this listing?" body="It goes live immediately and the seller is notified." action={(r) => moderateListing(id, "approve", r)} />
      ) : null}
      {status === "pending_review" ? (
        <>
          <AdminActionButton label="Request changes" title="Ask the seller to change this listing" requireReason reasonLabel="What should they change? (sent to the seller)" action={(r) => moderateListing(id, "request_changes", r)} />
          <AdminActionButton label="Reject" tone="danger" title="Reject this listing?" requireReason reasonLabel="Reason (sent to the seller)" action={(r) => moderateListing(id, "reject", r)} />
        </>
      ) : null}
      {status !== "removed" ? (
        <AdminActionButton label="Remove" variant="ghost" tone="danger" title="Remove this listing?" body="Removed listings disappear from the site and can't be edited by the seller. Pending promotions are cancelled." requireReason reasonLabel="Policy reason (sent to the seller)" action={(r) => moderateListing(id, "remove", r)} />
      ) : (
        <AdminActionButton label="Restore" title="Restore this listing?" body="It returns to the seller as paused; they can publish it again." requireReason action={(r) => moderateListing(id, "restore", r)} />
      )}
    </div>
  );
}
