import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { makeUser, publishedListing, service, signIn, signOut } from "./helpers";

test.describe.configure({ mode: "serial" });

test("1. a guest can browse and search listings", async ({ page }) => {
  const seller = await makeUser("guest-seller", "seller");
  const title = `Mahogany bookshelf ${randomUUID().slice(0, 4)}`;
  await publishedListing(seller.id, title);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Everything Circle sells. None of the traffic." })).toBeVisible();
  await page.locator("main").getByRole("combobox").fill(title);
  await page.locator("main").getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});

test("2. a visitor registers and completes their profile", async ({ page }) => {
  const email = `e2e-register-${randomUUID().slice(0, 8)}@test.questhub.local`;
  await page.goto("/register");
  await page.locator("#displayName").fill("Yaw Boateng");
  await page.locator("main #email").fill(email);
  await page.locator("main #password").fill("Kumasi2026!");
  await page.locator("input[name=acceptTerms]").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account\/profile/);
  await page.locator("#city").fill("Kejetia");
  await page.locator("#regionId").selectOption({ label: "Ashanti" });
  await page.locator("#phone").fill("0201234567");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  const { data } = await service.from("profiles").select("city,region_id").eq("display_name", "Yaw Boateng").order("created_at", { ascending: false }).limit(1).single();
  expect(data).toEqual({ city: "Kejetia", region_id: 2 });
});

test("3-8. publish, favourite, message, privacy, report and admin removal", async ({ browser }) => {
  const seller = await makeUser("seller", "seller");
  const buyer = await makeUser("buyer");
  const outsider = await makeUser("outsider");
  const admin = await makeUser("admin", "admin");
  const title = `Office desk with drawers ${randomUUID().slice(0, 4)}`;

  // 3. Seller publishes through the wizard
  const sellerPage = await (await browser.newContext()).newPage();
  await signIn(sellerPage, seller.email);
  await sellerPage.goto("/seller-dashboard/listings/new");
  await sellerPage.getByRole("button", { name: "Home & Furniture" }).click();
  await sellerPage.getByLabel("Furniture", { exact: true }).check();
  await sellerPage.getByRole("button", { name: /Continue/ }).click();
  await sellerPage.locator("#attr-material").selectOption("Wood");
  await sellerPage.getByRole("button", { name: /Continue/ }).click();
  await sellerPage.locator("#title").fill(title);
  await sellerPage.locator("#description").fill("Solid office desk with three drawers and a cable hole. Collect in Osu.");
  await sellerPage.getByRole("button", { name: /Continue/ }).click();
  await sellerPage.locator("#price").fill("1200");
  await sellerPage.getByRole("button", { name: /Continue/ }).click();
  await sellerPage.locator("#regionId").selectOption({ label: "Greater Accra" });
  await sellerPage.locator("#city").fill("Osu");
  await sellerPage.getByRole("button", { name: /Save draft and add photos/ }).click();
  await sellerPage.locator("#photos").setInputFiles("supabase/seed-images/dining-table.webp");
  await expect(sellerPage.getByText(/1 photo added/)).toBeVisible({ timeout: 30_000 });
  await sellerPage.getByRole("button", { name: /Continue/ }).click();
  await expect(sellerPage.getByRole("heading", { name: title })).toBeVisible();
  await sellerPage.getByRole("button", { name: /Continue/ }).click();
  await sellerPage.getByRole("button", { name: "Submit for review" }).click();
  await expect(sellerPage).toHaveURL(/\/seller-dashboard\/listings$/);
  await expect(sellerPage.getByText("In review").first()).toBeVisible();

  const { data: listing } = await service.from("listings").select("id,slug,status").eq("title", title).single();
  expect(listing!.status).toBe("pending_review");
  const { data: img } = await service.from("listing_images").select("storage_path").eq("listing_id", listing!.id).single();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${img!.storage_path}`);
  expect(res.status).toBe(200); // photo really uploaded

  // Admin approves
  const adminPage = await (await browser.newContext()).newPage();
  await signIn(adminPage, admin.email);
  await adminPage.goto("/admin/listings?status=pending_review");
  const row = adminPage.getByRole("row", { name: new RegExp(title) });
  await row.getByRole("button", { name: "Approve" }).click();
  await adminPage.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(adminPage.getByText("Listing approved.")).toBeVisible();
  await expect(row).toHaveCount(0);

  // 4. Buyer finds and saves it
  const buyerPage = await (await browser.newContext()).newPage();
  await signIn(buyerPage, buyer.email);
  await buyerPage.goto(`/search?q=${encodeURIComponent(title)}`);
  await buyerPage.getByRole("link", { name: title }).click();
  await buyerPage.locator("main").getByRole("button", { name: "Save listing" }).click();
  await expect(buyerPage.locator("main").getByRole("button", { name: "Remove from saved" })).toBeEnabled(); // save finished
  await buyerPage.goto("/favorites");
  await expect(buyerPage.getByRole("link", { name: title })).toBeVisible();
  await buyerPage.reload();
  await expect(buyerPage.getByRole("link", { name: title })).toBeVisible(); // persisted

  // 5. Buyer messages the seller
  await buyerPage.goto(`/listing/${listing!.slug}`);
  await buyerPage.getByRole("button", { name: "Message seller" }).click();
  await expect(buyerPage).toHaveURL(/\/messages\/[0-9a-f-]+$/);
  const conversationUrl = buyerPage.url();
  await buyerPage.getByLabel("Message", { exact: true }).fill("Hello, is the desk still available?");
  await buyerPage.getByRole("button", { name: "Send" }).click();
  await expect(buyerPage.getByRole("log", { name: "Messages" }).getByText("Hello, is the desk still available?")).toBeVisible();

  // 6. Seller sees it and replies; buyer receives it (after reload at least)
  await sellerPage.goto("/messages");
  await sellerPage.getByRole("link", { name: /E2E buyer/ }).click();
  await expect(sellerPage.getByRole("log", { name: "Messages" }).getByText("Hello, is the desk still available?")).toBeVisible();
  await sellerPage.getByLabel("Message", { exact: true }).fill("Yes, come by tomorrow.");
  await sellerPage.getByRole("button", { name: "Send" }).click();
  await expect(sellerPage.getByRole("log", { name: "Messages" }).getByText("Yes, come by tomorrow.")).toBeVisible();
  await buyerPage.reload();
  await expect(buyerPage.getByRole("log", { name: "Messages" }).getByText("Yes, come by tomorrow.")).toBeVisible();

  // 7. An outsider cannot read the conversation
  const outsiderPage = await (await browser.newContext()).newPage();
  await signIn(outsiderPage, outsider.email);
  const r = await outsiderPage.goto(conversationUrl);
  expect(r?.status()).toBe(404);
  await expect(outsiderPage.getByText("Hello, is the desk still available?")).toHaveCount(0);

  // 8. Outsider reports the listing; admin removes it and resolves the report
  await outsiderPage.goto(`/listing/${listing!.slug}`);
  await outsiderPage.getByRole("button", { name: "Report this listing" }).click();
  await outsiderPage.getByRole("dialog").getByLabel(/What's wrong/).selectOption("scam");
  await outsiderPage.getByRole("dialog").getByRole("button", { name: "Send report" }).click();
  await expect(outsiderPage.getByText(/moderators will review/)).toBeVisible();

  await adminPage.goto("/admin/reports");
  const reportRow = adminPage.getByRole("row", { name: new RegExp(title) });
  await reportRow.getByRole("button", { name: "Remove listing" }).click();
  await adminPage.getByRole("dialog").getByRole("textbox").fill("Advance payment scam");
  await adminPage.getByRole("dialog").getByRole("button", { name: "Remove listing" }).click();
  await expect(adminPage.getByText("Listing removed.")).toBeVisible();
  await reportRow.getByRole("button", { name: "Resolve" }).click();
  await adminPage.getByRole("dialog").getByRole("textbox").fill("Removed the listing");
  await adminPage.getByRole("dialog").getByRole("button", { name: "Resolve" }).click();
  await expect(adminPage.getByText("Report marked resolved.")).toBeVisible();
  await expect(reportRow).toHaveCount(0);

  await signOut(outsiderPage);
  const gone = await outsiderPage.goto(`/listing/${listing!.slug}`);
  expect(gone?.status()).toBe(404);
});

test("9. a seller cannot edit another seller's listing", async ({ page }) => {
  const owner = await makeUser("owner", "seller");
  const other = await makeUser("other", "seller");
  const l = await publishedListing(owner.id, `Owner's sofa ${randomUUID().slice(0, 4)}`);
  await signIn(page, other.email);
  const res = await page.goto(`/seller-dashboard/listings/${l.id}/edit`);
  expect(res?.status()).toBe(404);
});

test("protected routes redirect signed-out visitors and non-admins", async ({ page }) => {
  await page.goto("/seller-dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fseller-dashboard/);
  const buyer = await makeUser("nonadmin");
  await signIn(page, buyer.email);
  await page.goto("/admin");
  await expect(page).toHaveURL("/");
});
