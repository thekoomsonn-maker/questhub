import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { paymentsMode } from "@/lib/payments/config";
import { formatPrice } from "@/lib/format";
import { Card } from "@/components/ui/misc";
import { TestPaymentButtons } from "./buttons";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

/** Practice payment page, only in PAYMENTS_MODE=test. No money moves. */
export default async function TestPaymentPage({ params }: PageProps<"/checkout/test/[reference]">) {
  if (paymentsMode() !== "test") notFound();
  const { reference } = await params;
  const viewer = await requireViewer();
  const { data: payment } = await createServiceClient()
    .from("payments").select("reference,amount,status,user_id,method,provider_amount,fx_rate,order:orders(order_number,id)")
    .eq("reference", decodeURIComponent(reference)).eq("provider", "test").maybeSingle();
  if (!payment || payment.user_id !== viewer.id) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6 text-center">
        <FlaskConical className="mx-auto text-gold" size={36} aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-semibold">Test payment</h1>
        <p className="mt-1 text-sm text-ink-soft">This stands in for the Paystack or NOWPayments page while payments are in test mode. No money is taken.</p>
        {payment.method === "crypto" ? (
          <>
            <p className="mt-6 font-display text-4xl font-bold tabular">US${Number(payment.provider_amount).toFixed(2)}</p>
            <p className="text-sm text-ink-soft">in crypto, for {formatPrice(payment.amount)} at GH₵{Number(payment.fx_rate).toFixed(2)}/US$</p>
          </>
        ) : (
          <p className="mt-6 font-display text-4xl font-bold tabular">{formatPrice(payment.amount)}</p>
        )}
        <p className="text-sm text-ink-faint">Order {payment.order?.order_number}</p>
        {payment.status === "pending" ? (
          <TestPaymentButtons reference={payment.reference} />
        ) : (
          <p className="mt-6 text-sm">This payment was already completed ({payment.status}).</p>
        )}
      </Card>
    </div>
  );
}
