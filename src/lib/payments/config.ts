import "server-only";

/**
 * Payment configuration. PAYMENTS_MODE:
 *  - "off":  checkout disabled (default in production until configured)
 *  - "test": simulated payments, recorded as `test`, no money moves
 *  - "live": Paystack (Mobile Money and cards). Requires PAYSTACK_SECRET_KEY.
 *
 * Airtime/data delivery is a separate service (Paystack collects the money,
 * a top-up API sends the credit). Hubtel commission services are supported
 * for delivery; without them, top-ups stay hidden in live mode.
 */
export type PaymentsMode = "off" | "test" | "live";

export function paymentsMode(): PaymentsMode {
  const m = process.env.PAYMENTS_MODE;
  if (m === "live") return paystackConfigured() ? "live" : "off";
  if (m === "test") return "test";
  return "off";
}

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function paystack() {
  return {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
    baseUrl: process.env.PAYSTACK_API_URL ?? "https://api.paystack.co",
    currency: process.env.PAYSTACK_CURRENCY ?? "GHS",
  };
}

/** Airtime/data delivery credentials (Hubtel commission services). */
export function topupDeliveryConfigured() {
  return Boolean(process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET && process.env.HUBTEL_PREPAID_DEPOSIT_ID);
}

/** Top-ups are sold in test mode, or live when a delivery service is set up. */
export function topupsMode(): PaymentsMode {
  const mode = paymentsMode();
  if (mode === "live" && !topupDeliveryConfigured()) return "off";
  return mode;
}

export function hubtel() {
  return {
    clientId: process.env.HUBTEL_CLIENT_ID ?? "",
    clientSecret: process.env.HUBTEL_CLIENT_SECRET ?? "",
    callbackToken: process.env.HUBTEL_CALLBACK_TOKEN ?? "",
    // Airtime/data (Hubtel commission services). IDs come from your Hubtel dashboard.
    prepaidDepositId: process.env.HUBTEL_PREPAID_DEPOSIT_ID ?? "",
    topupUrl: process.env.HUBTEL_TOPUP_URL ?? "https://cs.hubtel.com/commissionservices/{deposit}/{service}",
    serviceIds: {
      mtn: { airtime: process.env.HUBTEL_SERVICE_MTN_AIRTIME ?? "", data: process.env.HUBTEL_SERVICE_MTN_DATA ?? "" },
      telecel: { airtime: process.env.HUBTEL_SERVICE_TELECEL_AIRTIME ?? "", data: process.env.HUBTEL_SERVICE_TELECEL_DATA ?? "" },
      airteltigo: { airtime: process.env.HUBTEL_SERVICE_AIRTELTIGO_AIRTIME ?? "", data: process.env.HUBTEL_SERVICE_AIRTELTIGO_DATA ?? "" },
    },
  };
}

export function basicAuth() {
  const h = hubtel();
  return `Basic ${Buffer.from(`${h.clientId}:${h.clientSecret}`).toString("base64")}`;
}

/** Crypto via NOWPayments. Off unless explicitly enabled and fully configured. */
export function cryptoConfigured() {
  return process.env.CRYPTO_PAYMENTS === "on" && Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);
}

export function nowpayments() {
  return {
    apiKey: process.env.NOWPAYMENTS_API_KEY ?? "",
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET ?? "",
    baseUrl: process.env.NOWPAYMENTS_API_URL ?? "https://api.nowpayments.io/v1",
  };
}

/**
 * Crypto is offered when: payments are in test mode (simulated), or live with
 * NOWPayments configured. In both cases an admin must set a GH₵/US$ rate.
 */
export function cryptoMode(): "off" | "test" | "live" {
  const mode = paymentsMode();
  if (mode === "test" && process.env.CRYPTO_PAYMENTS !== "off") return "test";
  if (process.env.PAYMENTS_MODE === "live" && cryptoConfigured()) return "live";
  return "off";
}
