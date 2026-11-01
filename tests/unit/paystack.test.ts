import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.PAYSTACK_SECRET_KEY = "sk_test_unit";
const { verifyPaystackSignature, paystackCheckout } = await import("@/lib/payments/providers");

const secret = "sk_test_unit";
const sign = (raw: string) => createHmac("sha512", secret).update(raw).digest("hex");

describe("Paystack webhook signature", () => {
  const raw = JSON.stringify({ event: "charge.success", data: { reference: "QH100001-ab12", amount: 1000 } });
  it("accepts the exact signed body", () => expect(verifyPaystackSignature(raw, sign(raw), secret)).toBe(true));
  it("rejects a tampered body", () => expect(verifyPaystackSignature(raw.replace("1000", "1"), sign(raw), secret)).toBe(false));
  it("rejects missing or wrong signatures", () => {
    expect(verifyPaystackSignature(raw, null, secret)).toBe(false);
    expect(verifyPaystackSignature(raw, "0".repeat(128), secret)).toBe(false);
    expect(verifyPaystackSignature(raw, sign(raw), "")).toBe(false);
  });
});

describe("Paystack verify", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (data: Record<string, unknown>) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: true, data }), { status: 200 })));

  it("maps success to paid and converts pesewas to cedis", async () => {
    stub({ status: "success", amount: 12550, currency: "GHS", id: 987, channel: "mobile_money" });
    expect(await paystackCheckout.verify("ref")).toMatchObject({ status: "paid", amount: 125.5, providerTransactionId: "987", channel: "mobile_money" });
  });
  it("treats a success in the wrong currency as failed", async () => {
    stub({ status: "success", amount: 12550, currency: "USD", id: 1 });
    expect((await paystackCheckout.verify("ref")).status).toBe("failed");
  });
  it("maps abandoned/failed to failed and ongoing to pending", async () => {
    stub({ status: "abandoned", amount: 100, currency: "GHS" });
    expect((await paystackCheckout.verify("ref")).status).toBe("failed");
    stub({ status: "ongoing", amount: 100, currency: "GHS" });
    expect((await paystackCheckout.verify("ref")).status).toBe("pending");
  });
});
