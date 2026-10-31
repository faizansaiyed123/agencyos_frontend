import { expect, test } from "@playwright/test";

test("signed-out visitors see the public AgencyOS homepage", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Good work deserves a better system\./i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Create your workspace/i }).first()).toHaveAttribute(
    "href",
    "/signup",
  );
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toHaveAttribute(
    "href",
    "/login",
  );
});
