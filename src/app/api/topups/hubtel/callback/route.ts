import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { hubtel, paymentsMode } from "@/lib/payments/config";
import { log } from "@/lib/log";

/**
 * Final status of an airtime/data top-up. We only accept results for top-ups
 * we actually sent (matching reference, still "sending").
 */
export async function POST(request: NextRequest) {
  if (paymentsMode() !== "live") return NextResponse.json({ ok: false }, { status: 404 });
  const expected = hubtel().callbackToken;
  const given = request.nextUrl.searchParams.get("token") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const code = String(body?.ResponseCode ?? "");
  const data = body?.Data ?? {};
  const clientRef = String(data.ClientReference ?? "");
  const orderNumber = clientRef.replace(/-\d+$/, "");
  if (!/^QH\d+$/.test(orderNumber)) return NextResponse.json({ ok: false }, { status: 400 });

  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("id,topup_status").eq("order_number", orderNumber).eq("kind", "topup").single();
  if (!order || order.topup_status !== "sending") return NextResponse.json({ ok: true }); // already handled

  if (code === "0000" || code === "2001") {
    const delivered = code === "0000";
    await db.rpc("record_topup_result", {
      p_order: order.id, p_delivered: delivered, p_provider_reference: data.TransactionId ?? undefined,
      p_error: delivered ? undefined : `Provider callback ${code}: ${String(data.Description ?? "").slice(0, 120)}`,
    });
    log.info("topup.callback", { orderNumber, code });
  }
  return NextResponse.json({ ok: true });
}
