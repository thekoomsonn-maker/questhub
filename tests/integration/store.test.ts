/**
 * Store and payment security: totals come from the database, only the server
 * (service role) can confirm payments, and confirmations are idempotent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, deleteUsers, service, type TestUser } from "./helpers";

let buyer: TestUser;
let other: TestUser;
let admin: TestUser;
let productId: string;

beforeAll(async () => {
  [buyer, other, admin] = await Promise.all([createUser("shopper"), createUser("other-shopper"), createUser("store-admin", "admin")]);
  const { data } = await service.from("store_products").insert({ name: "Test power bank 10000 mAh", description: "A test product used by the integration suite.", price: 150, stock: 3 }).select("id").single();
  productId = data!.id;
});

afterAll(async () => {
  for (const u of [buyer, other]) await service.from("orders").delete().eq("user_id", u.id);
  await service.from("store_products").delete().eq("id", productId);
  await deleteUsers(buyer, other, admin);
});

async function placeOrder(user: TestUser) {
  return user.client.rpc("place_goods_order", { p_name: "Akosua Test", p_phone: "0241234567", p_region: 1, p_city: "Osu", p_address: "12 Oxford Street, near the bank", p_notes: "" });
}

describe("cart and orders", () => {
  it("prevents adding to someone else's cart", async () => {
    const { error } = await buyer.client.from("cart_items").insert({ user_id: other.id, product_id: productId, quantity: 1 });
    expect(error).not.toBeNull();
  });

  it("refuses to order more than is in stock", async () => {
    await buyer.client.from("cart_items").upsert({ user_id: buyer.id, product_id: productId, quantity: 5 });
    const { error } = await placeOrder(buyer);
    expect(error?.message).toMatch(/Only 3 of/);
  });

  it("prices the order from the database, reserves stock and empties the cart", async () => {
    await buyer.client.from("cart_items").upsert({ user_id: buyer.id, product_id: productId, quantity: 2 });
    const { data: orderId, error } = await placeOrder(buyer);
    expect(error).toBeNull();
    const { data: order } = await buyer.client.from("orders").select("subtotal,delivery_fee,total,status,payment_status").eq("id", orderId).single();
    expect(Number(order!.subtotal)).toBe(300);
    expect(Number(order!.total)).toBe(300 + Number(order!.delivery_fee));
    expect(order).toMatchObject({ status: "pending_payment", payment_status: "unpaid" });
    const { data: p } = await service.from("store_products").select("stock").eq("id", productId).single();
    expect(p!.stock).toBe(1);
    const { data: cart } = await buyer.client.from("cart_items").select("*");
    expect(cart).toHaveLength(0);
  });

  it("does not let customers create or edit orders directly", async () => {
    const insert = await buyer.client.from("orders").insert({ user_id: buyer.id, kind: "topup", subtotal: 1, total: 1, topup_network: "mtn", topup_type: "airtime", topup_recipient: "0241234567" });
    expect(insert.error).not.toBeNull();
    const { data: mine } = await buyer.client.from("orders").select("id").limit(1).single();
    const update = await buyer.client.from("orders").update({ status: "paid", payment_status: "paid" }).eq("id", mine!.id).select();
    expect(update.data ?? []).toHaveLength(0);
  });

  it("hides orders from other customers", async () => {
    const { data } = await other.client.from("orders").select("id").eq("user_id", buyer.id);
    expect(data).toHaveLength(0);
  });
});

describe("payment confirmation", () => {
  let orderId: string;
  let total: number;

  beforeAll(async () => {
    await buyer.client.from("cart_items").upsert({ user_id: buyer.id, product_id: productId, quantity: 1 });
    const { data } = await placeOrder(buyer);
    orderId = data!;
    const { data: o } = await service.from("orders").select("total").eq("id", orderId).single();
    total = Number(o!.total);
  });

  it("cannot be called by customers or admins from the browser", async () => {
    for (const u of [buyer, admin]) {
      const { error } = await u.client.rpc("confirm_order_payment", { p_order: orderId, p_amount: total, p_payment_status: "paid" });
      expect(error).not.toBeNull();
    }
  });

  it("rejects a payment for the wrong amount", async () => {
    const { error } = await service.rpc("confirm_order_payment", { p_order: orderId, p_amount: total - 1, p_payment_status: "paid" });
    expect(error?.message).toMatch(/does not match/);
    const { data } = await service.from("orders").select("payment_status").eq("id", orderId).single();
    expect(data!.payment_status).not.toBe("paid");
  });

  it("confirms once and ignores duplicates", async () => {
    const first = await service.rpc("confirm_order_payment", { p_order: orderId, p_amount: total, p_payment_status: "paid" });
    expect(first.error).toBeNull();
    const again = await service.rpc("confirm_order_payment", { p_order: orderId, p_amount: total, p_payment_status: "paid" });
    expect(again.error).toBeNull();
    const { data: events } = await service.from("order_events").select("status").eq("order_id", orderId).eq("status", "paid");
    expect(events).toHaveLength(1);
    const { data } = await buyer.client.from("orders").select("status,payment_status").eq("id", orderId).single();
    expect(data).toEqual({ status: "paid", payment_status: "paid" });
  });

  it("lets only admins move an order through fulfilment, in order", async () => {
    const asBuyer = await buyer.client.rpc("admin_update_order", { p_order: orderId, p_status: "shipped", p_note: "" });
    expect(asBuyer.error).not.toBeNull();
    const skip = await admin.client.rpc("admin_update_order", { p_order: orderId, p_status: "delivered", p_note: "" });
    expect(skip.error?.message).toMatch(/Can't move/);
    const ok = await admin.client.rpc("admin_update_order", { p_order: orderId, p_status: "shipped", p_note: "" });
    expect(ok.error).toBeNull();
  });
});

describe("top-ups", () => {
  it("prices data from the catalogue, not the client", async () => {
    const { data: bundle } = await service.from("topup_bundles").insert({ network: "mtn", name: "Test 1 GB", price: 12, provider_code: "TEST-1GB" }).select("id").single();
    const { data: orderId, error } = await buyer.client.rpc("place_topup_order", { p_network: "mtn", p_type: "data", p_recipient: "0241234567", p_amount: 0.01, p_bundle: bundle!.id });
    expect(error).toBeNull();
    const { data } = await buyer.client.from("orders").select("total,topup_status").eq("id", orderId).single();
    expect(Number(data!.total)).toBe(12);
    expect(data!.topup_status).toBe("waiting_payment");
    await service.from("orders").delete().eq("id", orderId);
    await service.from("topup_bundles").delete().eq("id", bundle!.id);
  });

  it("enforces airtime limits and number format", async () => {
    const tooBig = await buyer.client.rpc("place_topup_order", { p_network: "mtn", p_type: "airtime", p_recipient: "0241234567", p_amount: 100000 });
    expect(tooBig.error?.message).toMatch(/between/);
    const badNumber = await buyer.client.rpc("place_topup_order", { p_network: "mtn", p_type: "airtime", p_recipient: "12345", p_amount: 5 });
    expect(badNumber.error?.message).toMatch(/10-digit/);
  });

  it("only the server can record a top-up result", async () => {
    const { data: orderId } = await buyer.client.rpc("place_topup_order", { p_network: "telecel", p_type: "airtime", p_recipient: "0201234567", p_amount: 5 });
    const { error } = await buyer.client.rpc("record_topup_result", { p_order: orderId, p_delivered: true });
    expect(error).not.toBeNull();
  });
});

describe("expiry", () => {
  it("cancels unpaid orders after they expire and returns stock", async () => {
    await service.from("store_products").update({ stock: 2 }).eq("id", productId);
    await other.client.from("cart_items").upsert({ user_id: other.id, product_id: productId, quantity: 1 });
    const { data: before } = await service.from("store_products").select("stock").eq("id", productId).single();
    const { data: orderId } = await placeOrder(other);
    await service.from("orders").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", orderId);
    await service.rpc("expire_unpaid_orders");
    const { data: o } = await service.from("orders").select("status").eq("id", orderId).single();
    const { data: after } = await service.from("store_products").select("stock").eq("id", productId).single();
    expect(o!.status).toBe("cancelled");
    expect(after!.stock).toBe(before!.stock);
  });
});
