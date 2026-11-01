import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { hubtel, paymentsMode } from "@/lib/payments/config";
import { hubtelCheckout } from "@/lib/payments/providers";
import { applyVerification } from "@/lib/payments/service";
import { log } from "@/lib/log";

function tokenOk(given: string | null) {
  const expected = hubtel().callbackToken;
  if (!expected) return true; // optional extra check; verification below is what matters
  if (!given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Hubtel checkout callback. The payload is NOT trusted: we only use it to
 * learn which payment to check, then ask Hubtel for the real status.
 */
export async function POST(request: NextRequest) {
  if (paymentsMode() !== "live") return NextResponse.json({ ok: false }, { status: 404 });
  if (!tokenOk(request.nextUrl.searchParams.get("token"))) return NextResponse.json({ ok: false }, { status: 401 });

  let reference: string | undefined;
  try {
    const body = await request.json();
    reference = body?.Data?.ClientReference ?? body?.data?.clientReference;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!reference || typeof reference !== "string" || reference.length > 40) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const v = await hubtelCheckout.verify(reference);
    const result = await applyVerification(reference, v, `status-check:${reference}:${v.status}`);
    log.info("payment.callback", { reference, status: v.status, ok: result.ok });
  } catch (e) {
    log.error("payment.callback_error", { reference, error: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ ok: false }, { status: 500 }); // let Hubtel retry
  }
  return NextResponse.json({ ok: true });
}
