import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { AdminHeader, Table } from "../ui";

export default async function AdminPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id,purpose,provider,method,reference,amount,currency,provider_amount,provider_currency,pay_currency,status,channel,verified_at,created_at,user:profiles!payments_user_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <>
      <AdminHeader title="Payments" description="Records are written only by the server after the payment provider confirms them. They can't be edited here." />
      {!env.checkoutEnabled ? <div className="mb-4"><FormMessage tone="info">Online checkout is off. Set PAYMENTS_MODE and the Hubtel keys (see README) to start taking payments.</FormMessage></div> : null}
      <Table head={["Reference", "Customer", "For", "Amount", "Status", "Date"]} empty={!data?.length}>
        {data?.map((p) => (
          <tr key={p.id}>
            <td className="px-3 py-3 font-mono text-xs">{p.reference}<div className="text-ink-faint">{p.provider}{p.channel ? ` · ${p.channel}` : ""}</div></td>
            <td className="px-3 py-3">{p.user?.display_name}</td>
            <td className="px-3 py-3 text-ink-soft">{p.purpose}</td>
            <td className="px-3 py-3 font-display font-semibold tabular">
              {formatPrice(p.amount, p.currency)}
              {p.method === "crypto" ? <div className="font-sans text-xs font-normal text-ink-faint">US${Number(p.provider_amount).toFixed(2)}{p.pay_currency ? ` paid in ${p.pay_currency.toUpperCase()}` : ""}</div> : null}
            </td>
            <td className="px-3 py-3"><Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge></td>
            <td className="px-3 py-3 text-ink-soft">{formatDate(p.verified_at ?? p.created_at)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
