/**
 * Database security tests: run against a local Supabase stack with real
 * buyer, seller and admin accounts. These exercise RLS policies, guard
 * triggers and RPC permission checks exactly as the app's clients would.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  approve,
  attributeIds,
  categoryId,
  createReadyDraft,
  createUser,
  deleteUsers,
  service,
  setSetting,
  type TestUser,
} from "./helpers";

let buyer: TestUser;
let seller: TestUser;
let otherSeller: TestUser;
let stranger: TestUser;
let admin: TestUser;

beforeAll(async () => {
  [buyer, seller, otherSeller, stranger, admin] = await Promise.all([
    createUser("buyer"),
    createUser("seller", "seller"),
    createUser("other-seller", "seller"),
    createUser("stranger"),
    createUser("admin", "admin"),
  ]);
  await setSetting("require_listing_review", true);
});

afterAll(async () => {
  await setSetting("require_listing_review", true);
  await deleteUsers(buyer, seller, otherSeller, stranger, admin);
});

describe("profiles and roles", () => {
  it("creates a buyer profile automatically on sign-up", async () => {
    const { data } = await buyer.client.from("profiles").select("role,status").eq("id", buyer.id).single();
    expect(data).toEqual({ role: "buyer", status: "active" });
  });

  it("prevents users from granting themselves admin", async () => {
    const { error } = await buyer.client.from("profiles").update({ role: "admin" }).eq("id", buyer.id);
    expect(error?.message).toMatch(/protected profile fields/);
  });

  it("prevents users from verifying themselves", async () => {
    const { error } = await seller.client.from("profiles").update({ is_verified: true }).eq("id", seller.id);
    expect(error).not.toBeNull();
  });

  it("allows editing own display name but not someone else's", async () => {
    const own = await buyer.client.from("profiles").update({ display_name: "Ama B." }).eq("id", buyer.id).select();
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);
    const other = await buyer.client.from("profiles").update({ display_name: "Hacked" }).eq("id", seller.id).select();
    expect(other.data).toHaveLength(0);
  });

  it("hides phone numbers unless the owner opts in", async () => {
    await service.from("profile_contacts").update({ phone: "0244000000", show_phone: false }).eq("user_id", seller.id);
    const hidden = await buyer.client.from("profile_contacts").select("phone").eq("user_id", seller.id);
    expect(hidden.data).toHaveLength(0);
    await service.from("profile_contacts").update({ show_phone: true }).eq("user_id", seller.id);
    const shown = await buyer.client.from("profile_contacts").select("phone").eq("user_id", seller.id);
    expect(shown.data?.[0]?.phone).toBe("0244000000");
    const visitor = await anon().from("profile_contacts").select("phone").eq("user_id", seller.id);
    expect(visitor.data ?? []).toHaveLength(0);
  });

  it("lets a buyer upgrade to seller only through become_seller()", async () => {
    const before = await stranger.client.from("listings").insert({
      category_id: await categoryId("furniture"),
      title: "Plastic chairs x4",
      description: "",
      region_id: 1,
    });
    expect(before.error).not.toBeNull();
    const { error } = await stranger.client.rpc("become_seller");
    expect(error).toBeNull();
    const { data } = await stranger.client.from("profiles").select("role").eq("id", stranger.id).single();
    expect(data?.role).toBe("seller");
  });
});

describe("listing lifecycle and status rules", () => {
  let listingId: string;

  it("rejects listings created directly as published", async () => {
    const { error } = await seller.client.from("listings").insert({
      category_id: await categoryId("furniture"),
      title: "Sneaky published listing",
      description: "Trying to skip moderation entirely here.",
      region_id: 1,
      status: "published",
    });
    expect(error?.message).toMatch(/draft|review/i);
  });

  it("ignores a client-supplied seller_id", async () => {
    const { data } = await seller.client
      .from("listings")
      .insert({
        category_id: await categoryId("furniture"),
        title: "Ownership test listing",
        seller_id: otherSeller.id,
        region_id: 1,
      })
      .select("seller_id")
      .single();
    expect(data?.seller_id).toBe(seller.id);
  });

  it("requires photos before submitting", async () => {
    const { data } = await seller.client
      .from("listings")
      .insert({ category_id: await categoryId("furniture"), title: "No photo sofa", description: "A comfortable three-seater sofa, grey fabric.", region_id: 1 })
      .select()
      .single();
    const { error } = await seller.client.from("listings").update({ status: "pending_review" }).eq("id", data!.id);
    expect(error?.message).toMatch(/photo/i);
  });

  it("requires category-specific fields before submitting", async () => {
    const { data } = await seller.client
      .from("listings")
      .insert({ category_id: await categoryId("cars"), title: "Toyota Corolla 2015", description: "Clean car, first owner in Ghana, full service history.", region_id: 1 })
      .select()
      .single();
    await seller.client.from("listing_images").insert({ listing_id: data!.id, storage_path: `${seller.id}/${data!.id}/a.jpg` });
    const { error } = await seller.client.from("listings").update({ status: "pending_review" }).eq("id", data!.id);
    expect(error?.message).toMatch(/Missing required details: .*Make/);
  });

  it("rejects attributes that belong to another category", async () => {
    const draft = await createReadyDraft(seller);
    const carAttrs = await attributeIds("cars");
    const { error } = await seller.client
      .from("listing_attribute_values")
      .insert({ listing_id: draft.id, attribute_id: carAttrs.make, value_text: "Toyota" });
    expect(error?.message).toMatch(/does not apply/);
  });

  it("moves a submitted listing to pending review, not published", async () => {
    const draft = await createReadyDraft(seller);
    listingId = draft.id;
    const { data, error } = await seller.client
      .from("listings")
      .update({ status: "pending_review" })
      .eq("id", listingId)
      .select("status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending_review");
  });

  it("does not let a seller publish their own pending listing", async () => {
    const { error } = await seller.client.from("listings").update({ status: "published" }).eq("id", listingId);
    expect(error?.message).toMatch(/Cannot change listing/);
  });

  it("keeps pending listings out of public view", async () => {
    const { data } = await anon().from("listings").select("id").eq("id", listingId);
    expect(data).toHaveLength(0);
  });

  it("does not let non-admins run moderation", async () => {
    const { error } = await seller.client.rpc("admin_moderate_listing", {
      p_listing: listingId, p_action: "approve", p_reason: "",
    });
    expect(error?.message).toMatch(/Administrator access required/);
  });

  it("publishes after admin approval and records it in the audit log", async () => {
    await approve(admin, listingId);
    const { data } = await anon().from("listings").select("status,expires_at").eq("id", listingId).single();
    expect(data?.status).toBe("published");
    expect(data?.expires_at).not.toBeNull();
    const audit = await admin.client.from("admin_actions").select("action").eq("target_id", listingId);
    expect(audit.data?.map((a) => a.action)).toContain("listing.approve");
    const notes = await seller.client.from("notifications").select("type").eq("reference_id", listingId);
    expect(notes.data?.map((n) => n.type)).toContain("moderation");
  });

  it("prevents another seller from editing the listing", async () => {
    const { data } = await otherSeller.client
      .from("listings").update({ price: 1 }).eq("id", listingId).select();
    expect(data).toHaveLength(0);
    const check = await service.from("listings").select("price").eq("id", listingId).single();
    expect(Number(check.data?.price)).toBe(1500);
  });

  it("lets the owner pause and republish without review", async () => {
    let r = await seller.client.from("listings").update({ status: "paused" }).eq("id", listingId).select("status").single();
    expect(r.data?.status).toBe("paused");
    r = await seller.client.from("listings").update({ status: "published" }).eq("id", listingId).select("status").single();
    expect(r.data?.status).toBe("published");
  });

  it("sends edited content back to review", async () => {
    const r = await seller.client
      .from("listings")
      .update({ title: "Solid wood dining table + chairs" })
      .eq("id", listingId)
      .select("status")
      .single();
    expect(r.data?.status).toBe("pending_review");
    await approve(admin, listingId);
  });

  it("protects counters and moderation fields", async () => {
    const { error } = await seller.client.from("listings").update({ view_count: 9999 }).eq("id", listingId);
    expect(error?.message).toMatch(/protected listing fields/);
  });

  it("holds listings with prohibited terms even when auto-approval is on", async () => {
    await setSetting("require_listing_review", false);
    const clean = await createReadyDraft(otherSeller, { title: "Office desk in great shape" });
    const flagged = await createReadyDraft(otherSeller, { title: "Counterfeit designer bags" });
    const a = await otherSeller.client.from("listings").update({ status: "pending_review" }).eq("id", clean.id).select("status").single();
    const b = await otherSeller.client.from("listings").update({ status: "pending_review" }).eq("id", flagged.id).select("status,flagged_terms").single();
    await setSetting("require_listing_review", true);
    expect(a.data?.status).toBe("published");
    expect(b.data?.status).toBe("pending_review");
    expect(b.data?.flagged_terms).toContain("counterfeit");
  });

  it("finds published listings through search", async () => {
    const { data, error } = await anon().rpc("search_listings", { p_query: "dining table" });
    expect(error).toBeNull();
    expect(data?.some((r: { id: string }) => r.id === listingId)).toBe(true);
  });

  it("removed listings cannot be edited by the seller", async () => {
    const draft = await createReadyDraft(otherSeller, { title: "Listing to be removed" });
    await otherSeller.client.from("listings").update({ status: "pending_review" }).eq("id", draft.id);
    await admin.client.rpc("admin_moderate_listing", { p_listing: draft.id, p_action: "remove", p_reason: "Prohibited" });
    const { error } = await otherSeller.client.from("listings").update({ status: "draft" }).eq("id", draft.id);
    expect(error?.message).toMatch(/removed by moderators/);
  });
});

describe("favorites", () => {
  let listingId: string;
  beforeAll(async () => {
    const draft = await createReadyDraft(seller, { title: "Favorite me lamp" });
    await seller.client.from("listings").update({ status: "pending_review" }).eq("id", draft.id);
    await approve(admin, draft.id);
    listingId = draft.id;
  });

  it("saves once and rejects duplicates", async () => {
    const first = await buyer.client.from("favorites").insert({ user_id: buyer.id, listing_id: listingId });
    expect(first.error).toBeNull();
    const dup = await buyer.client.from("favorites").insert({ user_id: buyer.id, listing_id: listingId });
    expect(dup.error?.code).toBe("23505");
  });

  it("keeps favorites private", async () => {
    const { data } = await stranger.client.from("favorites").select("*").eq("user_id", buyer.id);
    expect(data).toHaveLength(0);
    const forged = await stranger.client.from("favorites").insert({ user_id: buyer.id, listing_id: listingId });
    expect(forged.error).not.toBeNull();
  });
});

describe("messaging privacy", () => {
  let listingId: string;
  let conversationId: string;

  beforeAll(async () => {
    const draft = await createReadyDraft(seller, { title: "Samsung fridge, double door" });
    await seller.client.from("listings").update({ status: "pending_review" }).eq("id", draft.id);
    await approve(admin, draft.id);
    listingId = draft.id;
  });

  it("starts one conversation per buyer and listing", async () => {
    const a = await buyer.client.rpc("start_conversation", { p_listing: listingId });
    const b = await buyer.client.rpc("start_conversation", { p_listing: listingId });
    expect(a.error).toBeNull();
    expect(a.data).toBe(b.data);
    conversationId = a.data as string;
  });

  it("stops sellers messaging themselves", async () => {
    const { error } = await seller.client.rpc("start_conversation", { p_listing: listingId });
    expect(error?.message).toMatch(/cannot message yourself/);
  });

  it("lets both participants send and read messages", async () => {
    const sent = await buyer.client.from("messages").insert({ conversation_id: conversationId, sender_id: buyer.id, body: "Is this still available?" });
    expect(sent.error).toBeNull();
    const reply = await seller.client.from("messages").insert({ conversation_id: conversationId, sender_id: seller.id, body: "Yes it is." });
    expect(reply.error).toBeNull();
    const seen = await seller.client.from("messages").select("body").eq("conversation_id", conversationId);
    expect(seen.data).toHaveLength(2);
    const notes = await seller.client.from("notifications").select("type").eq("reference_id", conversationId);
    expect(notes.data?.length).toBe(1);
  });

  it("blocks outsiders from reading or posting", async () => {
    const read = await stranger.client.from("messages").select("*").eq("conversation_id", conversationId);
    expect(read.data).toHaveLength(0);
    const conv = await stranger.client.from("conversations").select("*").eq("id", conversationId);
    expect(conv.data).toHaveLength(0);
    const post = await stranger.client.from("messages").insert({ conversation_id: conversationId, sender_id: stranger.id, body: "hi" });
    expect(post.error).not.toBeNull();
    const visitor = await anon().from("messages").select("*").eq("conversation_id", conversationId);
    expect(visitor.data ?? []).toHaveLength(0);
  });

  it("does not allow impersonating the other participant", async () => {
    const { error } = await buyer.client.from("messages").insert({ conversation_id: conversationId, sender_id: seller.id, body: "fake" });
    expect(error).not.toBeNull();
  });

  it("stops messages after a block", async () => {
    await seller.client.from("user_blocks").insert({ blocker_id: seller.id, blocked_id: buyer.id });
    const { error } = await buyer.client.from("messages").insert({ conversation_id: conversationId, sender_id: buyer.id, body: "hello?" });
    expect(error?.message).toMatch(/blocked/);
    await seller.client.from("user_blocks").delete().eq("blocked_id", buyer.id);
  });

  it("lets only the confirmed buyer review a sold item", async () => {
    const sold = await seller.client
      .from("listings").update({ status: "sold", sold_to_buyer_id: buyer.id }).eq("id", listingId).select("status").single();
    expect(sold.data?.status).toBe("sold");
    const outsider = await stranger.client.from("reviews").insert({ listing_id: listingId, seller_id: seller.id, reviewer_id: stranger.id, rating: 1 });
    expect(outsider.error?.message).toMatch(/confirmed buyer/);
    const ok = await buyer.client.from("reviews").insert({ listing_id: listingId, seller_id: seller.id, reviewer_id: buyer.id, rating: 5, comment: "Smooth deal" });
    expect(ok.error).toBeNull();
    const again = await buyer.client.from("reviews").insert({ listing_id: listingId, seller_id: seller.id, reviewer_id: buyer.id, rating: 5 });
    expect(again.error?.code).toBe("23505");
    const system = await buyer.client.from("messages").select("kind").eq("conversation_id", conversationId).eq("kind", "system");
    expect(system.data).toHaveLength(1);
  });
});

describe("reports and moderation", () => {
  let reportId: string;
  let listingId: string;

  beforeAll(async () => {
    const draft = await createReadyDraft(otherSeller, { title: "Suspicious cheap iPhone" });
    await otherSeller.client.from("listings").update({ status: "pending_review" }).eq("id", draft.id);
    await approve(admin, draft.id);
    listingId = draft.id;
  });

  it("lets users report a listing once while it is open", async () => {
    const { data, error } = await buyer.client
      .from("reports")
      .insert({ reporter_id: buyer.id, target_type: "listing", listing_id: listingId, reason: "scam", details: "Asks for MoMo deposit" })
      .select("id,reported_user_id,status")
      .single();
    expect(error).toBeNull();
    expect(data?.reported_user_id).toBe(otherSeller.id);
    reportId = data!.id;
    const dup = await buyer.client.from("reports").insert({ reporter_id: buyer.id, target_type: "listing", listing_id: listingId, reason: "scam" });
    expect(dup.error?.code).toBe("23505");
  });

  it("hides reports from other users and blocks non-admin resolution", async () => {
    const seen = await stranger.client.from("reports").select("*").eq("id", reportId);
    expect(seen.data).toHaveLength(0);
    const { error } = await buyer.client.rpc("admin_update_report", { p_report: reportId, p_status: "resolved", p_note: "" });
    expect(error?.message).toMatch(/Administrator/);
  });

  it("lets an admin remove the listing and resolve the report", async () => {
    await admin.client.rpc("admin_moderate_listing", { p_listing: listingId, p_action: "remove", p_reason: "Advance-payment scam" });
    const r = await admin.client.rpc("admin_update_report", { p_report: reportId, p_status: "resolved", p_note: "Listing removed" });
    expect(r.error).toBeNull();
    const pub = await anon().from("listings").select("id").eq("id", listingId);
    expect(pub.data).toHaveLength(0);
    const audit = await admin.client.from("admin_actions").select("action").in("target_id", [listingId, reportId]);
    expect(audit.data?.map((a) => a.action)).toEqual(expect.arrayContaining(["listing.remove", "report.resolved"]));
  });

  it("hides the audit log from non-admins", async () => {
    const { data } = await seller.client.from("admin_actions").select("*");
    expect(data).toHaveLength(0);
  });

  it("stops admins changing their own role or status", async () => {
    const { error } = await admin.client.rpc("admin_set_user_status", { p_user: admin.id, p_status: "suspended", p_reason: "x" });
    expect(error?.message).toMatch(/own account/);
  });

  it("hides a suspended seller's listings", async () => {
    const draft = await createReadyDraft(stranger, { title: "Listing from a soon-suspended user" });
    await stranger.client.from("listings").update({ status: "pending_review" }).eq("id", draft.id);
    await approve(admin, draft.id);
    await admin.client.rpc("admin_set_user_status", { p_user: stranger.id, p_status: "suspended", p_reason: "Fraud reports" });
    const pub = await anon().from("listings").select("id").eq("id", draft.id);
    expect(pub.data).toHaveLength(0);
    const blocked = await stranger.client.from("listings").update({ price: 5 }).eq("id", draft.id).select();
    expect(blocked.data).toHaveLength(0);
    await admin.client.rpc("admin_set_user_status", { p_user: stranger.id, p_status: "active", p_reason: "Appeal accepted" });
  });
});

describe("promotions and payments", () => {
  let listingId: string;
  let promotionId: string;

  beforeAll(async () => {
    const draft = await createReadyDraft(seller, { title: "Promotable office chair" });
    await seller.client.from("listings").update({ status: "pending_review" }).eq("id", draft.id);
    await approve(admin, draft.id);
    listingId = draft.id;
  });

  it("creates a promotion request priced from the plan", async () => {
    const { data: plan } = await seller.client.from("promotion_plans").select("id,price").eq("kind", "boost").order("price").limit(1).single();
    const { data, error } = await seller.client.rpc("request_promotion", { p_listing: listingId, p_plan: plan!.id });
    expect(error).toBeNull();
    promotionId = data as string;
    const { data: promo } = await seller.client.from("promotions").select("status,payment_status,amount").eq("id", promotionId).single();
    expect(promo).toMatchObject({ status: "pending_payment", payment_status: "unpaid" });
    expect(Number(promo!.amount)).toBe(Number(plan!.price));
  });

  it("does not let sellers activate or mark promotions paid", async () => {
    const upd = await seller.client.from("promotions").update({ status: "active", payment_status: "paid" }).eq("id", promotionId).select();
    expect(upd.data ?? []).toHaveLength(0);
    const rpc = await seller.client.rpc("admin_activate_promotion_test", { p_promotion: promotionId, p_reason: "" });
    expect(rpc.error).not.toBeNull();
  });

  it("never lets clients write payment records", async () => {
    const ins = await seller.client.from("payments").insert({
      user_id: seller.id, purpose: "promotion", provider: "paystack", reference: "fake-ref", amount: 25, status: "paid",
    });
    expect(ins.error).not.toBeNull();
  });

  it("activates in test mode with payment_status 'test', never 'paid'", async () => {
    const { error } = await admin.client.rpc("admin_activate_promotion_test", { p_promotion: promotionId, p_reason: "QA" });
    expect(error).toBeNull();
    const { data } = await seller.client.from("promotions").select("status,payment_status").eq("id", promotionId).single();
    expect(data).toEqual({ status: "active", payment_status: "test" });
    const search = await anon().rpc("search_listings", { p_query: "office chair" });
    expect(search.data?.[0]?.is_boosted).toBe(true);
  });
});
