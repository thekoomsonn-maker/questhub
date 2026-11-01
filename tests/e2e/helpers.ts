import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
export const PASSWORD = "E2e-password-123";

export async function makeUser(label: string, role: "buyer" | "seller" | "admin" = "buyer") {
  const email = `e2e-${label}-${randomUUID().slice(0, 8)}@test.questhub.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `E2E ${label}` } });
  if (error) throw error;
  if (role !== "buyer") await service.from("profiles").update({ role }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("main #email").fill(email);
  await page.locator("main #password").fill(PASSWORD);
  await page.locator("main button[type=submit]").click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}

/** A published listing created directly (for tests that aren't about the wizard). */
export async function publishedListing(sellerId: string, title: string) {
  const { data: cat } = await service.from("categories").select("id").eq("slug", "furniture").single();
  const { data: l, error } = await service.from("listings").insert({
    seller_id: sellerId, category_id: cat!.id, title, description: "Clean and sturdy, collection from Osu only.", price: 750, region_id: 1, city: "Osu", status: "draft",
  }).select("id,slug").single();
  if (error) throw error;
  await service.from("listing_images").insert({ listing_id: l.id, storage_path: `${sellerId}/${l.id}/seed.webp` });
  await service.from("listings").update({ status: "published" }).eq("id", l.id);
  return l;
}
