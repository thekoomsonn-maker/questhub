import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminHeader, Table, Tabs } from "../ui";
import { orderStatusLabel } from "@/app/(site)/orders/status";
import { OrderAdminActions } from "./order-admin-actions";

const TABS = [
  { key: "", label: "To fulfil", statuses: ["paid", "processing", "shipped"] },
  { key: "attention", label: "Needs attention", statuses: ["refund_due", "failed"] },
  { key: "unpaid", label: "Awaiting payment", statuses: ["pending_payment"] },
  { key: "done", label: "Completed", statuses: ["delivered", "refunded", "cancelled"] },
] as const;

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === (sp.status ?? "")) ?? TABS[0];
  const supabase = await createClient();
  const [{ data, error }, { data: all }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_number,kind,status,payment_status,total,created_at,paid_at,delivery_name,delivery_phone,delivery_address,delivery_city,topup_network,topup_type,topup_recipient,topup_bundle_name,topup_status,topup_last_error,topup_attempts,staff_note,region:regions(name),customer:profiles!orders_user_id_fkey(display_name),order_items(product_name,quantity)")
      .in("status", [...tab.statuses])
      .order("created_at", { ascending: tab.key === "" })
      .limit(200),
    supabase.from("orders").select("status"),
  ]);
  if (error) throw error;

  return (
    <>
      <AdminHeader title="Store orders" description="Oldest paid orders first. Customers are notified at every step." />
      <Tabs base="/admin/orders" current={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: (all ?? []).filter((o) => (t.statuses as readonly string[]).includes(o.status)).length }))} />
      <Table head={["Order", "Customer", "Items / top-up", "Status", "Actions"]} empty={!data?.length}>
        {data?.map((o) => (
          <tr key={o.id}>
            <td className="px-3 py-3">
              <p className="font-medium">{o.order_number}</p>
              <p className="font-display font-semibold tabular">{formatPrice(o.total)}</p>
              <p className="text-xs text-ink-faint">{formatDate(o.created_at)} {formatTime(o.created_at)}</p>
            </td>
            <td className="px-3 py-3 text-sm">
              <p>{o.customer?.display_name}</p>
              {o.kind === "goods" ? (
                <p className="max-w-[16rem] text-xs text-ink-soft">{o.delivery_name}, {o.delivery_phone}<br />{o.delivery_address}{o.delivery_city ? `, ${o.delivery_city}` : ""}{o.region ? `, ${o.region.name}` : ""}</p>
              ) : null}
            </td>
            <td className="px-3 py-3 text-sm">
              {o.kind === "goods" ? (
                <ul>{o.order_items.map((i, n) => <li key={n}>{i.quantity} × {i.product_name}</li>)}</ul>
              ) : (
                <>
                  <p>{o.topup_type === "data" ? `Data: ${o.topup_bundle_name}` : "Airtime"} · {o.topup_network?.toUpperCase()}</p>
                  <p className="tabular text-ink-soft">{o.topup_recipient}</p>
                  {o.topup_last_error ? <p className="text-xs text-danger">{o.topup_last_error} (attempt {o.topup_attempts})</p> : null}
                </>
              )}
              {o.staff_note ? <p className="mt-1 text-xs text-ink-faint">Note: {o.staff_note}</p> : null}
            </td>
            <td className="px-3 py-3">
              <Badge tone={["refund_due", "failed"].includes(o.status) ? "danger" : o.status === "delivered" ? "success" : "brand"}>{orderStatusLabel[o.status]}</Badge>
              <div className="mt-1">
                {o.payment_status === "test" ? <Badge tone="gold">Test, unpaid</Badge> : <span className="text-xs text-ink-faint">payment: {o.payment_status}</span>}
              </div>
            </td>
            <td className="px-3 py-3"><OrderAdminActions id={o.id} kind={o.kind} status={o.status} topupStatus={o.topup_status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
