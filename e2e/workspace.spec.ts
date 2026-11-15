import { expect, test } from "@playwright/test";

test("workspace roles, browser persistence, and reset work end to end", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello, Morgan" })).toBeVisible();

  await page.getByLabel("View workspace as").selectOption("client@agencyos.local");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Acme Global", level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Acme Global", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: /Client Portal Workflow Upgrade Proposal/ }).click();
  await expect(page.getByRole("button", { name: "Accept proposal" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Accept proposal" }).click();
  await expect(page.getByText("Client Portal Workflow Upgrade", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await expect(page.getByRole("heading", { name: "Hello, Morgan" })).toBeVisible();
  await expect(page.getByLabel("View workspace as")).toHaveValue("owner@agencyos.local");
});
