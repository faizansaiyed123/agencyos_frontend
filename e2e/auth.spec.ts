import { expect, test } from "@playwright/test";

test("a returning visitor with a saved workspace session enters AgencyOS", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Hello, Morgan" })).toBeVisible();
});
