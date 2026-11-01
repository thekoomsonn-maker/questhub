/** Vendor shops: approval, buy-online listings, orders paid directly to vendors. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approve, createReadyDraft, createUser, deleteUsers, service, type TestUser } from "./helpers";

let vendor: TestUser;
let rival: TestUser;
let buyer: TestUser;
let snoop: TestUser;
let admin: TestUser;
let shopId: string;
let listingId: string;

const order = (u: TestUser, method: "pay_on_delivery" | "momo_to_vendor" = "pay_on_delivery") =>
  u.client.rpc("place_shop_order", { p_shop: shopId, p_payment: method, p_name: "Kwesi Buyer", p_phone: "0241234567", p_region: 1, p_city: "Osu", p_address: "Oxford St", p_note: "" });

beforeAll(async () => {
  [vendor, rival, buyer, snoop, admin] = await Promise.all([
    createUser("vendor", "seller"), createUser("rival", "seller"), createUser("vbuyer"), createUser("snoop"), createUser("shop-admin", "admin"),
  ]);
});

afterAll(async () => {
  for (const u of [buyer, snoop]) await service.from("vendor_orders").delete().eq("buyer_id", u.id);
  await service.from("shops").delete().in("owner_id", [vendor.id, rival.id]);
  await deleteUsers(vendor, rival, buyer, snoop, admin);
});

describe("shops", () => {
  it("starts pending and can't be self-approved, verified or featured", async () => {
    const { data, error } = await vendor.client.from("shops")
      .insert({ owner_id: vendor.id, slug: `ama-styles-${vendor.id.slice(0, 6)}`, name: "Ama Styles", status: "active", is_verified: true, accepts_pay_on_delivery: true })
      .select("id,status,is_verified").single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "pending", is_verified: false });
    shopId = data!.id;
    const upd = await vendor.client.from("shops").update({ status: "active" }).eq("id", shopId);
    expect(upd.error?.message).toMatch(/protected shop fields/);
  });

  it("is hidden from the public until an admin approves it", async () => {
    const { data: hidden } = await snoop.client.from("shops").select("id").eq("id", shopId);
    expect(hidden).toHaveLength(0);
    const r = await admin.client.rpc("admin_set_shop_status", { p_shop: shopId, p_status: "active", p_reason: "" });
    expect(r.error).toBeNull();
    const { data: visible } = await snoop.client.from("shops").select("id").eq("id", shopId);
    expect(visible).toHaveLength(1);
  });

  it("only lets buyers (not other sellers) edit a shop they own", async () => {
    const { data } = await rival.client.from("shops").update({ name: "Hijacked" }).eq("id", shopId).select();
    expect(data).toHaveLength(0);
  });

  it("requires a live shop to sell online", async () => {
    const draft = await createReadyDraft(rival);
    const { error } = await rival.client.from("listings").update({ orderable: true }).eq("id", draft.id);
    expect(error?.message).toMatch(/Open your shop/);
  });
});

describe("vendor orders", () => {
  beforeAll(async () => {
    const draft = await createReadyDraft(vendor, { title: "Kente bow tie, handwoven", price: 80, quantity: 3 });
    await vendor.client.from("listings").update({ orderable: true, status: "pending_review" }).eq("id", draft.id);
    await approve(admin, draft.id);
    listingId = draft.id;
  });

  it("refuses orders from the vendor's own account and unsupported payment methods", async () => {
    await vendor.client.from("shop_cart_items").insert({ user_id: vendor.id, listing_id: listingId, quantity: 1 });
    const self = await order(vendor);
    expect(self.error).not.toBeNull();
    await buyer.client.from("shop_cart_items").upsert({ user_id: buyer.id, listing_id: listingId, quantity: 2 });
    const momo = await order(buyer, "momo_to_vendor");
    expect(momo.error?.message).toMatch(/payment method/);
  });

  it("prices from the listing, reserves quantity and notifies the vendor", async () => {
    const { data: id, error } = await order(buyer);
    expect(error).toBeNull();
    const { data: o } = await buyer.client.from("vendor_orders").select("subtotal,status").eq("id", id).single();
    expect(o).toMatchObject({ status: "requested" });
    expect(Number(o!.subtotal)).toBe(160);
    const { data: l } = await service.from("listings").select("quantity").eq("id", listingId).single();
    expect(l!.quantity).toBe(1);
    const { data: n } = await vendor.client.from("notifications").select("type").eq("reference_id", id);
    expect(n?.[0]?.type).toBe("shop_order");
  });

  it("keeps orders private to the buyer and the shop", async () => {
    const { data } = await snoop.client.from("vendor_orders").select("id").eq("shop_id", shopId);
    expect(data).toHaveLength(0);
    const { data: v } = await vendor.client.from("vendor_orders").select("id").eq("shop_id", shopId);
    expect(v!.length).toBeGreaterThan(0);
  });

  it("lets only the shop owner advance an order, in order", async () => {
    const { data: o } = await vendor.client.from("vendor_orders").select("id").eq("shop_id", shopId).limit(1).single();
    const byRival = await rival.client.rpc("vendor_update_order", { p_order: o!.id, p_status: "confirmed", p_note: "" });
    expect(byRival.error).not.toBeNull();
    const byBuyer = await buyer.client.from("vendor_orders").update({ status: "completed" }).eq("id", o!.id).select();
    expect(byBuyer.data ?? []).toHaveLength(0);
    const skip = await vendor.client.rpc("vendor_update_order", { p_order: o!.id, p_status: "completed", p_note: "" });
    expect(skip.error?.message).toMatch(/Can't move/);
    const ok = await vendor.client.rpc("vendor_update_order", { p_order: o!.id, p_status: "confirmed", p_note: "" });
    expect(ok.error).toBeNull();
    const late = await buyer.client.rpc("buyer_update_vendor_order", { p_order: o!.id, p_action: "cancel" });
    expect(late.error?.message).toMatch(/already confirmed/);
  });

  it("returns stock when a buyer cancels an unconfirmed order", async () => {
    await buyer.client.from("shop_cart_items").upsert({ user_id: buyer.id, listing_id: listingId, quantity: 1 });
    const { data: id, error } = await order(buyer);
    expect(error).toBeNull();
    const before = (await service.from("listings").select("quantity").eq("id", listingId).single()).data!.quantity;
    const r = await buyer.client.rpc("buyer_update_vendor_order", { p_order: id, p_action: "cancel" });
    expect(r.error).toBeNull();
    const after = (await service.from("listings").select("quantity").eq("id", listingId).single()).data!.quantity;
    expect(after).toBe(before + 1);
  });

  it("switches off online ordering when a shop is suspended", async () => {
    await admin.client.rpc("admin_set_shop_status", { p_shop: shopId, p_status: "suspended", p_reason: "Complaints" });
    const { data: l } = await service.from("listings").select("orderable").eq("id", listingId).single();
    expect(l!.orderable).toBe(false);
    const { data: s } = await snoop.client.from("shops").select("id").eq("id", shopId);
    expect(s).toHaveLength(0);
  });
});
