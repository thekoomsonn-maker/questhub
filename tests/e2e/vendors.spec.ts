import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { makeUser, publishedListing, service, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("a vendor opens a shop, sells online, and a buyer orders and pays the vendor", async ({ browser }) => {
  const vendor = await makeUser("vendor", "seller");
  const buyer = await makeUser("shop-buyer");
  const admin = await makeUser("shop-admin", "admin");
  const slug = `kente-corner-${randomUUID().slice(0, 6)}`;
  const listing = await publishedListing(vendor.id, `Kente bow tie ${randomUUID().slice(0, 4)}`);

  // Vendor opens the shop
  const v = await (await browser.newContext()).newPage();
  await signIn(v, vendor.email);
  await v.goto("/seller-dashboard/shop");
  await v.locator("#s-name").fill("Kente Corner");
  await v.locator("#s-slug").fill(slug);
  await v.locator("#s-region").selectOption({ label: "Ashanti" });
  await v.locator("#s-city").fill("Bonwire");
  await v.getByLabel("Mobile Money to my number before delivery").check();
  await v.locator("#s-momo").fill("0241112223");
  await v.locator("#s-momo-name").fill("Kofi Asante");
  await v.getByRole("button", { name: "Create shop" }).click();
  await expect(v.getByText("Waiting for review")).toBeVisible();

  // Not public yet
  const anonPage = await (await browser.newContext()).newPage();
  expect((await anonPage.goto(`/shop/${slug}`))?.status()).toBe(404);

  // Admin approves
  const a = await (await browser.newContext()).newPage();
  await signIn(a, admin.email);
  await a.goto("/admin/shops");
  const row = a.getByRole("row", { name: /Kente Corner/ });
  await row.getByRole("button", { name: "Approve" }).click();
  await a.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(a.getByText("Shop approved.")).toBeVisible();

  // Vendor switches on online ordering for a listing
  await v.goto(`/seller-dashboard/listings/${listing.id}/edit`);
  await v.getByRole("button", { name: /Price & condition/ }).click();
  await v.locator("#quantity").fill("4");
  await v.getByLabel(/Let buyers order this online/).check();
  for (let i = 0; i < 2; i++) await v.getByRole("button", { name: /Continue/ }).click();
  await expect(v.getByRole("heading", { name: "Photos" })).toBeVisible();
  for (let i = 0; i < 2; i++) await v.getByRole("button", { name: /Continue/ }).click();
  await v.getByRole("button", { name: "Save changes" }).click();
  await expect(v).toHaveURL(/\/seller-dashboard\/listings$/);

  // Buyer finds the shop and orders
  const b = await (await browser.newContext()).newPage();
  await signIn(b, buyer.email);
  await b.goto(`/shop/${slug}`);
  await expect(b.getByRole("heading", { level: 1, name: /Kente Corner/ })).toBeVisible();
  await b.getByRole("link", { name: /Kente bow tie/ }).click();
  await b.getByRole("button", { name: "Order online" }).click();
  await expect(b.getByText(/added to your cart/)).toBeVisible();
  await b.goto("/cart");
  await b.getByRole("link", { name: "Order from Kente Corner" }).click();
  await b.locator("#phone").fill("0201234567");
  await b.getByLabel(/MoMo to the shop/).check();
  await b.getByRole("button", { name: "Place order" }).click();
  await expect(b).toHaveURL(/\/orders\/shop\/.+\?placed=1/);
  await expect(b.getByText("Wait for the shop to confirm")).toBeVisible();
  const { data: l } = await service.from("listings").select("quantity").eq("id", listing.id).single();
  expect(l!.quantity).toBe(3); // reserved

  // Vendor confirms; buyer sees the MoMo details and marks paid; vendor completes
  await v.goto("/seller-dashboard/orders");
  await v.getByRole("button", { name: "Confirm order" }).click();
  await expect(v.getByText("Order updated.")).toBeVisible();
  await b.reload();
  await expect(b.getByText("0241112223")).toBeVisible();
  await expect(b.getByText("Kofi Asante")).toBeVisible();
  await b.getByRole("button", { name: /I've sent the MoMo payment/ }).click();
  await expect(b.getByText("you marked this as paid")).toBeVisible();
  await v.goto("/seller-dashboard/orders?status=active");
  await expect(v.getByText(/Buyer says paid/)).toBeVisible();
  await v.getByRole("button", { name: "MoMo received" }).click();
  await v.getByRole("button", { name: "Out for delivery" }).click();
  await v.getByRole("button", { name: "Mark completed" }).click();
  await b.reload();
  await expect(b.getByText("Completed").first()).toBeVisible();
});

test("crypto checkout in test mode shows the US$ amount and confirms the order", async ({ page }) => {
  const buyer = await makeUser("crypto-buyer");
  await signIn(page, buyer.email);
  await page.goto("/airtime");
  await page.locator("#recipient").fill("0241234567");
  await expect(page.getByLabel(/^Crypto/)).toBeDisabled(); // GH₵10 is under US$1
  await page.getByRole("button", { name: "50", exact: true }).click();
  await page.getByLabel(/^Crypto/).check();
  await page.getByRole("button", { name: /^Pay GH₵ 50/ }).click();
  await expect(page.getByText(/^US\$\d+\.\d{2}$/)).toBeVisible();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByText("Delivered").first()).toBeVisible();
  const { data } = await service.from("payments").select("method,provider_currency,status").eq("user_id", buyer.id).single();
  expect(data).toEqual({ method: "crypto", provider_currency: "USD", status: "test" });
});
