"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buyerVendorOrderAction } from "../../../shop/actions";

export function BuyerVendorOrderActions({ orderId, canCancel, canMarkPaid }: { orderId: string; canCancel: boolean; canMarkPaid: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canCancel && !canMarkPaid) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {canMarkPaid ? (
        <Button pending={pending} onClick={() => start(async () => {
          const r = await buyerVendorOrderAction(orderId, "mark_paid");
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        })}>I&apos;ve sent the MoMo payment</Button>
      ) : null}
      {canCancel ? (
        <ConfirmDialog title="Cancel this order?" confirmLabel="Cancel order" onConfirm={async () => {
          const r = await buyerVendorOrderAction(orderId, "cancel");
          if (r.ok) { toast.success(r.message); router.refresh(); }
          return r;
        }} trigger={(open) => <Button variant="secondary" onClick={open}>Cancel order</Button>} />
      ) : null}
    </div>
  );
}
