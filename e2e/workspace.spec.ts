import { expect, test } from "@playwright/test";

test("workspace roles, browser persistence, and reset work end to end", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello, Morgan" })).toBeVisible();

  await page.getByLabel("View workspace as").selectOption("client@agencyos.local");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Acme Global" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Acme Global" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await expect(page.getByRole("heading", { name: "Hello, Morgan" })).toBeVisible();
  await expect(page.getByLabel("View workspace as")).toHaveValue("owner@agencyos.local");
});
