import { expect, test } from "@playwright/test";

test("a first-time visitor lands in the interactive AgencyOS workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Hello, Morgan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clients", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByLabel("View workspace as")).toHaveValue("owner@agencyos.local");
  await expect(page.getByRole("link", { name: "Digital Experience Rebuild", exact: true })).toBeVisible();
});
