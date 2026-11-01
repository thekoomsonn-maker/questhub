import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { refreshOrderPayment } from "@/lib/payments/service";
import { paymentsMode } from "@/lib/payments/config";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { Card } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { OrderStatusBadge, orderStatusLabel } from "../status";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Order details" };

const networkName = { mtn: "MTN", telecel: "Telecel", airteltigo: "AirtelTigo" } as const;

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const viewer = await requireViewer(`/orders/${id}`);
  // Coming back from the payment page: ask the provider directly rather than waiting for the callback.
  if (sp.return) await refreshOrderPayment(id);

  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("*, region:regions(name), order_items(id,product_name,unit_price,quantity,line_total), order_events(status,note,created_at)")
    .eq("id", id)
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (!o) notFound();
  o.order_events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const awaiting = o.status === "pending_payment" && ["unpaid", "pending", "failed"].includes(o.payment_status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/orders" className="text-sm text-brand hover:underline">All orders</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Order {o.order_number}</h1>
        <OrderStatusBadge status={o.status} paymentStatus={o.payment_status} />
      </div>
      <p className="text-sm text-ink-faint">Placed {formatDate(o.created_at)} at {formatTime(o.created_at)}</p>

      <div className="mt-4 flex flex-col gap-3">
        {sp.payment === "unavailable" ? <FormMessage>We couldn&apos;t open the payment page. Your order is saved; try paying again below.</FormMessage> : null}
        {sp.cancelled ? <FormMessage tone="info">Payment was cancelled. You can try again while the order is open.</FormMessage> : null}
        {o.payment_status === "pending" && o.status === "pending_payment" ? <FormMessage tone="info">We&apos;re waiting for the payment provider to confirm. This usually takes under a minute; refresh to check.</FormMessage> : null}
        {o.payment_status === "failed" && awaiting ? <FormMessage>The last payment attempt didn&apos;t go through. You can try again.</FormMessage> : null}
        {o.payment_status === "test" ? <FormMessage tone="info">This was a test-mode order. No money was taken{o.kind === "goods" ? " and nothing will be delivered" : ""}.</FormMessage> : null}
        {o.status === "refund_due" ? <FormMessage>We&apos;ll refund {formatPrice(o.total)} to the account you paid from. Contact support if it hasn&apos;t arrived within 3 working days.</FormMessage> : null}
      </div>

      <Card className="mt-4 p-5">
        {o.kind === "topup" ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-faint">Type</dt><dd className="font-medium">{o.topup_type === "data" ? `Data: ${o.topup_bundle_name}` : "Airtime"}</dd></div>
            <div><dt className="text-ink-faint">Network</dt><dd className="font-medium">{networkName[o.topup_network!]}</dd></div>
            <div><dt className="text-ink-faint">Number</dt><dd className="font-medium tabular">{o.topup_recipient}</dd></div>
            <div><dt className="text-ink-faint">Amount</dt><dd className="font-display font-semibold tabular">{formatPrice(o.total)}</dd></div>
          </dl>
        ) : (
          <>
            <ul className="divide-y divide-line text-sm">
              {o.order_items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2"><span>{i.quantity} × {i.product_name}</span><span className="tabular">{formatPrice(i.line_total)}</span></li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{formatPrice(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular">{Number(o.delivery_fee) === 0 ? "Free" : formatPrice(o.delivery_fee)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="font-display tabular">{formatPrice(o.total)}</dd></div>
            </dl>
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <p className="font-medium">Delivering to</p>
              <p className="text-ink-soft">{o.delivery_name} · {o.delivery_phone}</p>
              <p className="text-ink-soft">{o.delivery_address}{o.delivery_city ? `, ${o.delivery_city}` : ""}{o.region ? `, ${o.region.name}` : ""}</p>
            </div>
          </>
        )}
      </Card>

      {awaiting ? <OrderActions orderId={o.id} total={formatPrice(o.total)} canPay={paymentsMode() !== "off"} /> : null}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        <ol className="space-y-2 border-l-2 border-line pl-4">
          {o.order_events.map((e, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{orderStatusLabel[e.status] ?? e.status.replace(/_/g, " ")}</p>
              {e.note ? <p className="text-ink-soft">{e.note}</p> : null}
              <p className="text-xs text-ink-faint">{formatDate(e.created_at)} {formatTime(e.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
