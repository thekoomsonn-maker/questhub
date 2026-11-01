"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { vendorConfirmPayment, vendorUpdateOrder } from "./actions";

type Status = Parameters<typeof vendorUpdateOrder>[1];

export function VendorOrderActions({ id, status, momo, paymentConfirmed }: { id: string; status: string; momo: boolean; paymentConfirmed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (s: Status, note = "") => start(async () => {
    const r = await vendorUpdateOrder(id, s, note);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
  });
  const refuse = (s: "declined" | "cancelled", label: string) => (
    <ConfirmDialog
      title={`${label} this order?`}
      body="Reserved items go back on sale and the buyer is notified."
      confirmLabel={label}
      requireReason
      reasonLabel="Message to the buyer"
      onConfirm={async (reason) => {
        const r = await vendorUpdateOrder(id, s, reason);
        if (r.ok) { toast.success(r.message); router.refresh(); }
        return r;
      }}
      trigger={(open) => <Button size="sm" variant="ghost" className="text-danger" onClick={open}>{label}</Button>}
    />
  );
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {status === "requested" ? <><Button size="sm" pending={pending} onClick={() => go("confirmed")}>Confirm order</Button>{refuse("declined", "Decline")}</> : null}
      {status === "confirmed" ? (
        <>
          <Button size="sm" pending={pending} onClick={() => go("out_for_delivery")}>Out for delivery</Button>
          <Button size="sm" variant="secondary" pending={pending} onClick={() => go("ready_for_pickup")}>Ready for pickup</Button>
          {refuse("cancelled", "Cancel")}
        </>
      ) : null}
      {status === "out_for_delivery" || status === "ready_for_pickup" ? <><Button size="sm" pending={pending} onClick={() => go("completed")}>Mark completed</Button>{refuse("cancelled", "Cancel")}</> : null}
      {momo && !paymentConfirmed && !["declined", "cancelled", "completed"].includes(status) ? (
        <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => {
          const r = await vendorConfirmPayment(id);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        })}>MoMo received</Button>
      ) : null}
    </div>
  );
}
