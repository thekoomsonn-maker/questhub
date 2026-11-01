import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

if (!url || !publishableKey || !secretKey) {
  throw new Error("Integration tests need a running local Supabase (see README) and .env.local");
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client: bypasses RLS. Only for test setup/teardown. */
export const service = createClient(url, secretKey, noSession);

/** Anonymous visitor */
export const anon = () => createClient(url, publishableKey, noSession);

export type TestUser = { id: string; email: string; client: SupabaseClient };

export async function createUser(
  label: string,
  role: "buyer" | "seller" | "admin" = "buyer",
): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.questhub.local`;
  const password = "Test-password-123!";
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `${label} tester` },
  });
  if (error) throw error;
  const id = data.user.id;

  if (role !== "buyer") {
    const { error: roleError } = await service.from("profiles").update({ role }).eq("id", id);
    if (roleError) throw roleError;
  }

  const client = createClient(url, publishableKey, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id, email, client };
}

export async function deleteUsers(...users: (TestUser | undefined)[]) {
  for (const u of users) {
    if (!u) continue;
    // listings/conversations cascade from profiles -> auth.users
    await service.from("listings").delete().eq("seller_id", u.id);
    await service.auth.admin.deleteUser(u.id);
  }
}

export async function categoryId(slug: string) {
  const { data, error } = await service.from("categories").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id as string;
}

export async function attributeIds(slug: string) {
  const cat = await categoryId(slug);
  const { data } = await service.from("category_attributes").select("id,key").eq("category_id", cat);
  return Object.fromEntries((data ?? []).map((a) => [a.key, a.id])) as Record<string, string>;
}

/**
 * Creates a draft listing for a seller and makes it submittable
 * (one image row + required attributes for the "furniture" category,
 * which has no required attributes).
 */
export async function createReadyDraft(seller: TestUser, overrides: Record<string, unknown> = {}) {
  const { data, error } = await seller.client
    .from("listings")
    .insert({
      category_id: await categoryId("furniture"),
      title: "Solid wood dining table",
      description: "Six-seater dining table in very good condition, collected from Osu.",
      price: 1500,
      condition: "used",
      region_id: 1,
      city: "Osu",
      status: "draft",
      ...overrides,
    })
    .select()
    .single();
  if (error) throw error;
  const { error: imgError } = await seller.client.from("listing_images").insert({
    listing_id: data.id,
    storage_path: `${seller.id}/${data.id}/${randomUUID()}.jpg`,
    sort_order: 0,
  });
  if (imgError) throw imgError;
  return data as { id: string; slug: string; status: string };
}

/** Publishes a listing as an admin would (via the audited RPC). */
export async function approve(admin: TestUser, listingId: string) {
  const { error } = await admin.client.rpc("admin_moderate_listing", {
    p_listing: listingId,
    p_action: "approve",
    p_reason: "ok",
  });
  if (error) throw error;
}

export async function setSetting(key: string, value: unknown) {
  const { error } = await service.from("platform_settings").update({ value }).eq("key", key);
  if (error) throw error;
}
