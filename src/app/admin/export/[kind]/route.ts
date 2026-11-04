import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { staffCan, staffLevelOf, type StaffArea } from "@/lib/staff";
import { toCsv } from "@/lib/csv";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const MAX_ROWS = 20_000;
const PAGE = 1000;

type Kind = "orders" | "vendor-orders" | "vendors" | "listings" | "users" | "payments";
const area: Record<Kind, StaffArea> = {
  orders: "insights",
  "vendor-orders": "insights",
  vendors: "commerce",
  listings: "safety",
  users: "owner",
  payments: "owner",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Pages through a PostgREST query 1,000 rows at a time, up to MAX_ROWS. */
async function all<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function build(kind: Kind, supabase: Supabase, since: string): Promise<{ header: string[]; rows: unknown[][] }> {
  switch (kind) {
    case "orders": {
      const data = await all((a, b) => supabase.from("orders")
        .select("order_number,kind,status,payment_status,subtotal,delivery_fee,total,currency,created_at,paid_at,delivery_name,delivery_phone,delivery_city,delivery_address,topup_network,topup_type,topup_recipient,topup_bundle_name,topup_status,region:regions(name),order_items(product_name,quantity,unit_price)")
        .gte("created_at", since).order("created_at", { ascending: false }).range(a, b));
      return {
        header: ["Order", "Type", "Status", "Payment", "Subtotal", "Delivery fee", "Total", "Currency", "Placed", "Paid", "Customer", "Phone", "Region", "City", "Address", "Items", "Network", "Top-up", "Recipient", "Bundle", "Top-up status"],
        rows: data.map((o) => [o.order_number, o.kind, o.status, o.payment_status, o.subtotal, o.delivery_fee, o.total, o.currency, o.created_at, o.paid_at,
          o.delivery_name, o.delivery_phone, o.region?.name, o.delivery_city, o.delivery_address,
          o.order_items.map((i) => `${i.quantity} x ${i.product_name} @ ${i.unit_price}`).join("; "),
          o.topup_network, o.topup_type, o.topup_recipient, o.topup_bundle_name, o.topup_status]),
      };
    }
    case "vendor-orders": {
      const data = await all((a, b) => supabase.from("vendor_orders")
        .select("order_number,status,payment_method,buyer_marked_paid,vendor_confirmed_payment,subtotal,created_at,buyer_name,buyer_phone,delivery_city,shop:shops(name,slug),vendor_order_items(title,quantity,unit_price)")
        .gte("created_at", since).order("created_at", { ascending: false }).range(a, b));
      return {
        header: ["Order", "Shop", "Status", "Payment method", "Buyer says paid", "Shop confirmed payment", "Subtotal", "Placed", "Buyer", "Buyer phone", "City", "Items"],
        rows: data.map((o) => [o.order_number, o.shop?.name, o.status, o.payment_method, o.buyer_marked_paid, o.vendor_confirmed_payment, o.subtotal, o.created_at,
          o.buyer_name, o.buyer_phone, o.delivery_city, o.vendor_order_items.map((i) => `${i.quantity} x ${i.title} @ ${i.unit_price}`).join("; ")]),
      };
    }
    case "vendors": {
      const days = Math.round((Date.now() - new Date(since).getTime()) / 86_400_000);
      const { data, error } = await supabase.rpc("admin_vendor_report", { p_days: days });
      if (error) throw error;
      return {
        header: ["Shop", "URL", "Status", "Verified", "Orders", "Completed", "Declined", "Cancelled", "Open", "Sales (GHS)", "Completion %", "Median minutes to confirm", "Live ads", "Sold online"],
        rows: (data ?? []).map((r) => [r.name, `/shop/${r.slug}`, r.status, r.is_verified, r.orders, r.completed, r.declined, r.cancelled, r.open_orders, r.sales, r.completion_rate, r.median_confirm_minutes, r.live_listings, r.orderable_listings]),
      };
    }
    case "listings": {
      const data = await all((a, b) => supabase.from("listings")
        .select("slug,title,status,price,currency,condition,quantity,orderable,city,view_count,contact_count,created_at,published_at,sold_at,region:regions(name),category:categories(name),seller:profiles!listings_seller_id_fkey(display_name)")
        .gte("created_at", since).order("created_at", { ascending: false }).range(a, b));
      return {
        header: ["Title", "URL", "Status", "Price", "Currency", "Condition", "Quantity", "Sold online", "Category", "Region", "City", "Seller", "Views", "Contacts", "Created", "Published", "Sold"],
        rows: data.map((l) => [l.title, `/listing/${l.slug}`, l.status, l.price, l.currency, l.condition, l.quantity, l.orderable, l.category?.name, l.region?.name, l.city,
          l.seller?.display_name, l.view_count, l.contact_count, l.created_at, l.published_at, l.sold_at]),
      };
    }
    case "users": {
      const rows: unknown[][] = [];
      for (let offset = 0; offset < MAX_ROWS; offset += 100) {
        const { data, error } = await supabase.rpc("admin_list_users", { p_limit: 100, p_offset: offset });
        if (error) throw error;
        for (const u of data ?? []) {
          if (new Date(u.created_at) >= new Date(since)) rows.push([u.display_name, u.email, u.username, u.role, u.status, u.is_verified, u.listing_count, u.open_reports, u.created_at, u.last_sign_in_at]);
        }
        if (!data || data.length < 100) break;
      }
      return { header: ["Name", "Email", "Username", "Role", "Status", "Verified", "Listings", "Open reports", "Joined", "Last sign-in"], rows };
    }
    case "payments": {
      const data = await all((a, b) => supabase.from("payments")
        .select("reference,purpose,provider,method,status,amount,currency,provider_amount,provider_currency,channel,provider_transaction_id,created_at,verified_at")
        .gte("created_at", since).order("created_at", { ascending: false }).range(a, b));
      return {
        header: ["Reference", "For", "Provider", "Method", "Status", "Amount", "Currency", "Charged amount", "Charged currency", "Channel", "Provider transaction", "Started", "Verified"],
        rows: data.map((p) => [p.reference, p.purpose, p.provider, p.method, p.status, p.amount, p.currency, p.provider_amount, p.provider_currency, p.channel, p.provider_transaction_id, p.created_at, p.verified_at]),
      };
    }
  }
}

export async function GET(request: NextRequest, { params }: RouteContext<"/admin/export/[kind]">) {
  const { kind } = await params;
  if (!(kind in area)) return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  const viewer = await getViewer();
  const level = viewer ? staffLevelOf(viewer.profile) : null;
  if (!staffCan(level, area[kind as Kind])) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days")) || 30, 1), 3650);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const supabase = await createClient();
  try {
    const { header, rows } = await build(kind as Kind, supabase, since);
    await supabase.rpc("log_export", { p_kind: kind, p_days: days, p_rows: rows.length });
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="questhub-${kind}-${days}d-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    log.error("admin.export_failed", { kind, error: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
