import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

/**
 * Maintenance: expire listings, promotions and unpaid orders (restocking).
 * Call every 15 minutes with header `Authorization: Bearer $CRON_SECRET`
 * (Vercel Cron sends this automatically when CRON_SECRET is set).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const db = createServiceClient();
  const [listings, promotions, orders] = await Promise.all([
    db.rpc("expire_listings"),
    db.rpc("expire_promotions"),
    db.rpc("expire_unpaid_orders"),
  ]);
  const result = { listings: listings.data, promotions: promotions.data, orders: orders.data };
  log.info("cron.maintenance", result);
  return NextResponse.json({ ok: true, ...result });
}
