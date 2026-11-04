import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createUser, deleteUsers, service, type TestUser } from "./helpers";

/**
 * Staff levels are enforced in the database, so these tests call Supabase
 * directly as each kind of staff member, the way a hand-crafted request would.
 */
let owner: TestUser, manager: TestUser, moderator: TestUser, buyer: TestUser, target: TestUser;

beforeAll(async () => {
  [owner, manager, moderator, buyer, target] = await Promise.all([
    createUser("owner", "admin"),
    createUser("manager", "admin"),
    createUser("moderator", "admin"),
    createUser("buyer"),
    createUser("target"),
  ]);
  await service.from("profiles").update({ staff_level: "manager" }).eq("id", manager.id);
  await service.from("profiles").update({ staff_level: "moderator" }).eq("id", moderator.id);
});

afterAll(async () => {
  await service.from("site_banners").delete().like("title", "Test banner%");
  await deleteUsers(owner, manager, moderator, buyer, target);
});

describe("staff levels", () => {
  it("an admin with no level is an owner; others report their own level", async () => {
    expect((await owner.client.rpc("my_staff_level")).data).toBe("owner");
    expect((await manager.client.rpc("my_staff_level")).data).toBe("manager");
    expect((await moderator.client.rpc("my_staff_level")).data).toBe("moderator");
    expect((await buyer.client.rpc("my_staff_level")).data).toBeNull();
  });

  it("nobody can change their own staff level or role from the client", async () => {
    const r = await moderator.client.from("profiles").update({ staff_level: "owner" }).eq("id", moderator.id);
    expect(r.error?.code).toBe("42501");
    const b = await buyer.client.from("profiles").update({ role: "admin" }).eq("id", buyer.id);
    expect(b.error?.code).toBe("42501");
  });

  it("sales figures are for managers and owners only", async () => {
    expect((await owner.client.rpc("admin_sales_report", { p_days: 30 })).error).toBeNull();
    expect((await manager.client.rpc("admin_sales_report", { p_days: 30 })).error).toBeNull();
    expect((await moderator.client.rpc("admin_sales_report", { p_days: 30 })).error?.code).toBe("42501");
    expect((await buyer.client.rpc("admin_sales_report", { p_days: 30 })).error?.code).toBe("42501");
    expect((await moderator.client.rpc("admin_vendor_report", { p_days: 30 })).error?.code).toBe("42501");
  });

  it("the sales report never counts test payments as revenue", async () => {
    const { data } = await owner.client.rpc("admin_sales_report", { p_days: 365 });
    const before = (data as { totals: { store_revenue: number } }).totals.store_revenue;
    const { data: order } = await service.from("orders").insert({
      user_id: buyer.id, kind: "topup", subtotal: 10, total: 10, topup_network: "mtn", topup_type: "airtime",
      topup_recipient: "0241234567", payment_status: "test", status: "paid", paid_at: new Date().toISOString(),
    }).select("id").single();
    const { data: after } = await owner.client.rpc("admin_sales_report", { p_days: 365 });
    const a = after as { totals: { store_revenue: number; topup_revenue: number }; test_orders: number };
    expect(a.totals.store_revenue).toBe(before);
    expect(a.test_orders).toBeGreaterThanOrEqual(1);
    await service.from("orders").delete().eq("id", order!.id);
  });

  it("only owners can change platform settings", async () => {
    const m = await manager.client.from("platform_settings").update({ value: 99 }).eq("key", "max_images_per_listing").select();
    expect(m.data ?? []).toHaveLength(0); // filtered out by the restrictive policy
    const o = await owner.client.from("platform_settings").update({ value: 10 }).eq("key", "max_images_per_listing").select();
    expect(o.data).toHaveLength(1);
  });

  it("moderators cannot edit store products; managers can", async () => {
    const mod = await moderator.client.from("store_products").insert({ name: "Not allowed item", price: 10, stock: 1 });
    expect(mod.error).not.toBeNull();
    const mgr = await manager.client.from("store_products").insert({ name: "Manager test item", price: 10, stock: 1, is_active: false }).select("id").single();
    expect(mgr.error).toBeNull();
    await service.from("store_products").delete().eq("id", mgr.data!.id);
  });

  it("only owners can add, change or remove staff", async () => {
    expect((await manager.client.rpc("admin_set_staff", { p_user: target.id, p_level: "moderator" })).error?.code).toBe("42501");
    expect((await moderator.client.rpc("admin_set_user_role", { p_user: target.id, p_role: "seller", p_reason: "x" })).error?.code).toBe("42501");

    expect((await owner.client.rpc("admin_set_staff", { p_user: target.id, p_level: "moderator" })).error).toBeNull();
    const { data: p } = await service.from("profiles").select("role,staff_level").eq("id", target.id).single();
    expect(p).toEqual({ role: "admin", staff_level: "moderator" });

    expect((await owner.client.rpc("admin_set_staff", { p_user: target.id, p_level: null as unknown as "owner" })).error).toBeNull();
    const { data: after } = await service.from("profiles").select("role,staff_level").eq("id", target.id).single();
    expect(after).toEqual({ role: "buyer", staff_level: null });

    const { data: log } = await service.from("admin_actions").select("action").eq("target_id", target.id);
    expect(log!.map((l) => l.action)).toEqual(expect.arrayContaining(["staff.moderator", "staff.removed"]));
  });

  it("an owner cannot use admin_set_user_role to create admins", async () => {
    const r = await owner.client.rpc("admin_set_user_role", { p_user: target.id, p_role: "admin", p_reason: "x" });
    expect(r.error?.code).toBe("22023");
  });
});

describe("banners", () => {
  it("staff with store rights manage banners; the public sees only live ones", async () => {
    const live = await manager.client.from("site_banners").insert({ title: "Test banner live", placement: "home" }).select("id").single();
    expect(live.error).toBeNull();
    const future = await manager.client.from("site_banners")
      .insert({ title: "Test banner later", placement: "home", starts_at: new Date(Date.now() + 86_400_000).toISOString() }).select("id").single();
    expect(future.error).toBeNull();

    const { data: seen } = await anon().from("site_banners").select("title").like("title", "Test banner%");
    expect(seen!.map((b) => b.title)).toEqual(["Test banner live"]);

    const mod = await moderator.client.from("site_banners").insert({ title: "Test banner mod", placement: "home" });
    expect(mod.error).not.toBeNull();
    const buy = await buyer.client.from("site_banners").insert({ title: "Test banner buyer", placement: "home" });
    expect(buy.error).not.toBeNull();
  });

  it("banner links must stay on this site or use https", async () => {
    const r = await manager.client.from("site_banners")
      .insert({ title: "Test banner js", placement: "home", link_url: "javascript:alert(1)", link_label: "Go" });
    expect(r.error?.code).toBe("23514");
  });
});
