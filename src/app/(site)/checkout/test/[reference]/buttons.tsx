"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { simulatePayment } from "./actions";

export function TestPaymentButtons({ reference }: { reference: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-6 flex flex-col gap-2">
      <Button size="lg" pending={pending} onClick={() => start(() => simulatePayment(reference, "paid"))}>Simulate successful payment</Button>
      <Button size="lg" variant="secondary" disabled={pending} onClick={() => start(() => simulatePayment(reference, "failed"))}>Simulate failed payment</Button>
    </div>
  );
}
