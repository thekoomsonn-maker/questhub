import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { mapNowpaymentsStatus, verifyNowpaymentsSignature } = await import("@/lib/payments/providers");

const secret = "test-ipn-secret";
function sign(obj: unknown) {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v;
  return createHmac("sha512", secret).update(JSON.stringify(sort(obj))).digest("hex");
}

describe("NOWPayments IPN signature", () => {
  const body = { payment_status: "finished", payment_id: 123, order_id: "QH100001-ab12", price_amount: 9.5, price_currency: "usd", fee: { depositFee: 0, currency: "usdt" } };

  it("accepts a correctly signed body regardless of key order", () => {
    const raw = JSON.stringify({ price_currency: "usd", fee: { currency: "usdt", depositFee: 0 }, order_id: "QH100001-ab12", payment_id: 123, price_amount: 9.5, payment_status: "finished" });
    expect(verifyNowpaymentsSignature(raw, sign(body), secret)).toBe(true);
  });
  it("rejects tampered bodies, wrong secrets and missing signatures", () => {
    const tampered = JSON.stringify({ ...body, price_amount: 0.01 });
    expect(verifyNowpaymentsSignature(tampered, sign(body), secret)).toBe(false);
    expect(verifyNowpaymentsSignature(JSON.stringify(body), sign(body), "other-secret")).toBe(false);
    expect(verifyNowpaymentsSignature(JSON.stringify(body), null, secret)).toBe(false);
    expect(verifyNowpaymentsSignature("not json", sign(body), secret)).toBe(false);
  });
});

describe("NOWPayments status mapping", () => {
  it("only treats finished as paid", () => {
    expect(mapNowpaymentsStatus("finished")).toBe("paid");
    for (const s of ["waiting", "confirming", "confirmed", "sending"]) expect(mapNowpaymentsStatus(s)).toBe("pending");
    expect(mapNowpaymentsStatus("partially_paid")).toBe("partial");
    for (const s of ["failed", "expired", "refunded"]) expect(mapNowpaymentsStatus(s)).toBe("failed");
  });
});
