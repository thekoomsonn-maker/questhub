import { expect, test } from "@playwright/test";

test("mobile layout shows bottom navigation and filter sheet", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  for (const label of ["Home", "Categories", "Sell", "Messages", "Account"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
  await page.goto("/search");
  await page.getByRole("button", { name: /Filters/ }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
