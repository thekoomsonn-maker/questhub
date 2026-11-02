import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { Badge, Card } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { ShopLogo } from "@/components/shops/shop-card";
import { vendorStatusLabel } from "../../vendor-status";
import { BuyerVendorOrderActions } from "./buyer-actions";

export const metadata: Metadata = { title: "Shop order" };

export default async function ShopOrderPage({ params, searchParams }: PageProps<"/orders/shop/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const viewer = await requireViewer(`/orders/shop/${id}`);
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("vendor_orders")
    .select("*, shop:shops(name,slug,logo_path,phone,whatsapp,momo_number,momo_name), vendor_order_items(id,title,quantity,line_total), vendor_order_events(status,note,created_at)")
    .eq("id", id).eq("buyer_id", viewer.id).maybeSingle();
  if (!o) notFound();
  o.vendor_order_events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const showMomo = o.payment_method === "momo_to_vendor" && ["confirmed", "out_for_delivery", "ready_for_pickup"].includes(o.status) && !o.vendor_confirmed_payment;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/orders" className="text-sm text-brand hover:underline">All orders</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Order {o.order_number}</h1>
        <Badge tone={o.status === "completed" ? "success" : ["declined", "cancelled"].includes(o.status) ? "danger" : o.status === "requested" ? "gold" : "brand"}>{vendorStatusLabel[o.status]}</Badge>
      </div>
      <p className="text-sm text-ink-faint">Placed {formatDate(o.created_at)} at {formatTime(o.created_at)}</p>
      <div className="mt-4 flex flex-col gap-3">
        {sp.placed ? <FormMessage tone="success">Order sent to {o.shop?.name}. They&apos;ll confirm it soon; we&apos;ll notify you.</FormMessage> : null}
        {o.payment_method === "momo_to_vendor" && o.status === "requested" ? <FormMessage tone="info">Wait for the shop to confirm before sending any money.</FormMessage> : null}
        {o.vendor_note && ["declined", "cancelled"].includes(o.status) ? <FormMessage>Message from the shop: {o.vendor_note}</FormMessage> : null}
      </div>

      {showMomo ? (
        <Card className="mt-4 border-gold bg-gold-tint p-5">
          <h2 className="font-medium">Pay {formatPrice(o.subtotal)} by MoMo</h2>
          <p className="mt-1 font-display text-2xl font-bold tabular">{o.shop?.momo_number}</p>
          <p className="text-sm">Account name: <strong>{o.shop?.momo_name}</strong>. Use <strong>{o.order_number}</strong> as the reference.</p>
          <p className="mt-2 text-xs text-ink-soft">Check that the name your MoMo app shows matches before you confirm. QuestHub can&apos;t reverse MoMo payments.</p>
        </Card>
      ) : null}

      <Card className="mt-4 p-5">
        <Link href={`/shop/${o.shop?.slug}`} className="flex items-center gap-3 hover:text-brand">
          <ShopLogo path={o.shop?.logo_path ?? null} name={o.shop?.name ?? "?"} size={40} />
          <span className="font-medium">{o.shop?.name}</span>
        </Link>
        <ul className="mt-4 divide-y divide-line text-sm">{o.vendor_order_items.map((i) => <li key={i.id} className="flex justify-between py-2"><span>{i.quantity} × {i.title}</span><span className="tabular">{formatPrice(i.line_total)}</span></li>)}</ul>
        <div className="flex justify-between border-t border-line pt-3 font-bold"><span>Total</span><span className="font-display tabular">{formatPrice(o.subtotal)}</span></div>
        <p className="mt-2 text-sm text-ink-soft">{o.payment_method === "pay_on_delivery" ? "Pay on delivery or pickup" : "Pay the shop by MoMo"}{o.vendor_confirmed_payment ? ". The shop has confirmed your payment." : o.buyer_marked_paid ? ". You marked this as paid." : ""}</p>
        {o.shop?.phone || o.shop?.whatsapp ? <p className="mt-1 text-sm">Shop contact: {[o.shop.phone, o.shop.whatsapp].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" / ")}</p> : null}
      </Card>

      <BuyerVendorOrderActions orderId={o.id} canCancel={o.status === "requested"} canMarkPaid={showMomo && !o.buyer_marked_paid} />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        <ol className="space-y-2 border-l-2 border-line pl-4">
          {o.vendor_order_events.map((e, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{vendorStatusLabel[e.status] ?? e.status.replace(/_/g, " ")}</p>
              {e.note ? <p className="text-ink-soft">{e.note}</p> : null}
              <p className="text-xs text-ink-faint">{formatDate(e.created_at)} {formatTime(e.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
