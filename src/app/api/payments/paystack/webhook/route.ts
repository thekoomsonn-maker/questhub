import { NextResponse, type NextRequest } from "next/server";
import { paymentsMode, paystack } from "@/lib/payments/config";
import { paystackCheckout, verifyPaystackSignature } from "@/lib/payments/providers";
import { applyVerification } from "@/lib/payments/service";
import { log } from "@/lib/log";

/**
 * Paystack webhook. The signature proves the call came from Paystack, but we
 * still re-verify the transaction through the API before changing anything.
 * Set this URL in Paystack: Settings → API Keys & Webhooks → Webhook URL.
 */
export async function POST(request: NextRequest) {
  if (paymentsMode() !== "live") return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await request.text();
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), paystack().secretKey)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: string | undefined;
  let reference: string | undefined;
  try {
    const body = JSON.parse(raw);
    event = body?.event;
    reference = body?.data?.reference;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // Only charge events concern checkout; acknowledge everything else.
  if (!event?.startsWith("charge.")) return NextResponse.json({ ok: true });
  if (!reference || typeof reference !== "string" || reference.length > 64) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const v = await paystackCheckout.verify(reference);
    const result = await applyVerification(reference, v, `paystack:${reference}:${v.status}`);
    log.info("payment.webhook", { reference, event, status: v.status, ok: result.ok });
  } catch (e) {
    log.error("payment.webhook_error", { reference, error: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ ok: false }, { status: 500 }); // Paystack retries
  }
  return NextResponse.json({ ok: true });
}
