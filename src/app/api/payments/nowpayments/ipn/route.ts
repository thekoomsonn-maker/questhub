import { NextResponse, type NextRequest } from "next/server";
import { cryptoMode, nowpayments } from "@/lib/payments/config";
import { nowpaymentsApi, verifyNowpaymentsSignature } from "@/lib/payments/providers";
import { applyCryptoStatus } from "@/lib/payments/service";
import { log } from "@/lib/log";

/**
 * NOWPayments instant payment notification. Two independent checks:
 * 1. The HMAC-SHA512 signature over the sorted body must match our IPN secret.
 * 2. We then fetch the payment from NOWPayments ourselves and act only on that.
 */
export async function POST(request: NextRequest) {
  if (cryptoMode() !== "live") return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await request.text();
  if (raw.length > 20_000) return NextResponse.json({ ok: false }, { status: 413 });
  if (!verifyNowpaymentsSignature(raw, request.headers.get("x-nowpayments-sig"), nowpayments().ipnSecret)) {
    log.warn("crypto.ipn_bad_signature", {});
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = JSON.parse(raw) as { payment_id?: string | number };
  if (!body.payment_id) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const cp = await nowpaymentsApi.getPayment(String(body.payment_id));
    const result = await applyCryptoStatus(cp);
    log.info("crypto.ipn", { paymentId: cp.paymentId, status: cp.rawStatus, ok: result.ok });
  } catch (e) {
    log.error("crypto.ipn_error", { error: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ ok: false }, { status: 500 }); // NOWPayments retries
  }
  return NextResponse.json({ ok: true });
}
