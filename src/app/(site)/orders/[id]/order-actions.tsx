"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelOrder, payExistingOrder } from "../../checkout/actions";

export function OrderActions({ orderId, total, canPay }: { orderId: string; total: string; canPay: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {canPay ? <Button size="lg" pending={pending} onClick={() => start(() => payExistingOrder(orderId))}>Pay {total}</Button> : null}
      <ConfirmDialog
        title="Cancel this order?"
        body="Reserved items go back on sale. You won't be charged."
        confirmLabel="Cancel order"
        onConfirm={async () => {
          const r = await cancelOrder(orderId);
          if (r.ok) { toast.success(r.message); router.refresh(); }
          return r;
        }}
        trigger={(open) => <Button size="lg" variant="secondary" onClick={open}>Cancel order</Button>}
      />
    </div>
  );
}
