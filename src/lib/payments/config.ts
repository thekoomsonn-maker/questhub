import "server-only";

/**
 * Payment configuration. PAYMENTS_MODE:
 *  - "off":  checkout disabled (default in production until configured)
 *  - "test": simulated payments, recorded as `test`, no money moves
 *  - "live": Hubtel. Requires the HUBTEL_* variables below.
 */
export type PaymentsMode = "off" | "test" | "live";

export function paymentsMode(): PaymentsMode {
  const m = process.env.PAYMENTS_MODE;
  if (m === "live") return hubtelConfigured() ? "live" : "off";
  if (m === "test") return "test";
  return "off";
}

export function hubtelConfigured() {
  return Boolean(process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET && process.env.HUBTEL_MERCHANT_ACCOUNT);
}

export function hubtel() {
  return {
    clientId: process.env.HUBTEL_CLIENT_ID ?? "",
    clientSecret: process.env.HUBTEL_CLIENT_SECRET ?? "",
    merchantAccount: process.env.HUBTEL_MERCHANT_ACCOUNT ?? "",
    checkoutUrl: process.env.HUBTEL_CHECKOUT_URL ?? "https://payproxyapi.hubtel.com/items/initiate",
    // Confirm the status endpoint for your account in the Hubtel dashboard; it usually requires IP allow-listing.
    statusUrl: process.env.HUBTEL_STATUS_URL ?? "https://api-txnstatus.hubtel.com/transactions/{merchant}/status",
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
