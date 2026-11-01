import { Badge } from "@/components/ui/misc";

export const orderStatusLabel: Record<string, string> = {
  pending_payment: "Awaiting payment", paid: "Paid", processing: "Packing", shipped: "On the way", delivered: "Delivered",
  cancelled: "Cancelled", failed: "Failed", refund_due: "Refund pending", refunded: "Refunded",
};

export function OrderStatusBadge({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const tone = status === "delivered" ? "success" : ["cancelled", "failed", "refund_due"].includes(status) ? "danger" : status === "pending_payment" ? "gold" : "brand";
  return (
    <span className="flex gap-1">
      {paymentStatus === "test" ? <Badge tone="neutral">Test</Badge> : null}
      <Badge tone={tone}>{orderStatusLabel[status] ?? status}</Badge>
    </span>
  );
}
