import { expect, test } from "@playwright/test";
import { makeUser, service, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("a customer buys from the store and pays (test mode)", async ({ page }) => {
  const buyer = await makeUser("store-buyer");
  const { data: product } = await service.from("store_products").select("id,slug,name,brand,stock").eq("name", "Fast charger 25 W with USB-C cable").single();
  await signIn(page, buyer.email);

  await page.goto(`/store/${product!.slug}`);
  await page.locator("main").getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(/added to your cart/)).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("link", { name: new RegExp(product!.name) })).toBeVisible();
  await page.getByRole("link", { name: "Checkout" }).click();

  await page.locator("#phone").fill("0241234567");
  await page.locator("#regionId").selectOption({ label: "Greater Accra" });
  await page.locator("#city").fill("Spintex");
  await page.locator("#address").fill("GA-183-8164, opposite the Shell filling station");
  await page.getByRole("button", { name: /^Pay GH₵/ }).click();

  await expect(page.getByRole("heading", { name: "Test payment" })).toBeVisible();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+\?return=1/);
  await expect(page.getByText("This was a test-mode order")).toBeVisible();
  await expect(page.getByText("Paid").first()).toBeVisible();

  const { data: after } = await service.from("store_products").select("stock").eq("id", product!.id).single();
  expect(after!.stock).toBe(product!.stock - 1);
});

test("airtime top-up is delivered after payment, and a failed one is flagged for refund", async ({ page }) => {
  const buyer = await makeUser("airtime-buyer");
  await signIn(page, buyer.email);

  await page.goto("/airtime");
  await page.locator("#recipient").fill("0241234567");
  await expect(page.locator("label", { hasText: /^MTN$/ })).toHaveClass(/border-brand/); // detected from prefix
  await page.getByRole("button", { name: "20", exact: true }).click();
  await page.getByRole("button", { name: /^Pay GH₵ 20/ }).click();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByText("Delivered").first()).toBeVisible();

  await page.goto("/airtime");
  await page.locator("#recipient").fill("0201234000"); // test mode: numbers ending 000 fail
  await page.getByRole("button", { name: /^Pay GH₵ 10/ }).click();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByText("Refund pending").first()).toBeVisible();
  await expect(page.getByText(/We'll refund/)).toBeVisible();
});

test("10. a forged payment callback cannot mark an order as paid", async ({ page, request }) => {
  const buyer = await makeUser("forger");
  await signIn(page, buyer.email);
  await page.goto("/airtime");
  await page.locator("#recipient").fill("0551234567");
  await page.getByRole("button", { name: /^Pay GH₵ 10/ }).click();
  await expect(page.getByRole("heading", { name: "Test payment" })).toBeVisible();
  const reference = decodeURIComponent(page.url().split("/").pop()!);

  const res = await request.post("/api/payments/paystack/webhook", {
    headers: { "x-paystack-signature": "0".repeat(128) },
    data: { event: "charge.success", data: { reference, status: "success", amount: 1000, currency: "GHS" } },
  });
  expect(res.status()).not.toBe(200);
  const { data: payment } = await service.from("payments").select("status,order:orders(payment_status,status)").eq("reference", reference).single();
  expect(payment!.status).toBe("pending");
  expect(payment!.order).toMatchObject({ payment_status: "pending", status: "pending_payment" });
});
