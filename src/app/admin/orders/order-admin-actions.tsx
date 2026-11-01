"use client";

import { AdminActionButton } from "../action-button";
import { retryTopup, updateOrderStatus } from "../store-actions";

export function OrderAdminActions({ id, kind, status, topupStatus }: { id: string; kind: string; status: string; topupStatus: string | null }) {
  const step = (label: string, to: Parameters<typeof updateOrderStatus>[1], opts: { reason?: boolean; tone?: "danger"; variant?: "primary" | "ghost" } = {}) => (
    <AdminActionButton key={to} label={label} variant={opts.variant ?? "secondary"} tone={opts.tone} title={`${label}?`} requireReason={opts.reason} reasonLabel="Note (shown to the customer for refunds and cancellations)" action={(r) => updateOrderStatus(id, to, r)} />
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {kind === "goods" && status === "paid" ? [step("Start packing", "processing", { variant: "primary" }), step("Mark shipped", "shipped")] : null}
      {kind === "goods" && status === "processing" ? step("Mark shipped", "shipped", { variant: "primary" }) : null}
      {kind === "goods" && status === "shipped" ? step("Mark delivered", "delivered", { variant: "primary" }) : null}
      {kind === "goods" && (status === "paid" || status === "processing") ? step("Refund", "refund_due", { reason: true, tone: "danger", variant: "ghost" }) : null}
      {kind === "topup" && status === "refund_due" && topupStatus === "failed" ? (
        <AdminActionButton label="Retry top-up" variant="primary" title="Send the top-up again?" body="Check the provider dashboard first so the customer isn't topped up twice." requireReason action={(r) => retryTopup(id, r)} />
      ) : null}
      {status === "refund_due" ? step("Refund sent", "refunded", { reason: true }) : null}
      {status === "pending_payment" ? step("Cancel", "cancelled", { reason: true, tone: "danger", variant: "ghost" }) : null}
    </div>
  );
}
