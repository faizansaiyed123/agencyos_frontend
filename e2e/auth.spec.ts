import { expect, test } from "@playwright/test";

test("public sign-in route renders recovery entry point", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
