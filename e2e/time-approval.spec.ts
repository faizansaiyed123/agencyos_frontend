import { expect, test } from "@playwright/test";

test("project managers can approve another teammate's stopped time entry", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("View workspace as").selectOption("sarah@agencyos.local");
  await page.getByRole("link", { name: "My work", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Time waiting for approval" })).toBeVisible();
  await expect(page.getByText("Jamie Patel", { exact: true })).toBeVisible();
  await expect(page.getByText("Approve implementation time · 3 hours", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Nothing to approve", { exact: true })).toBeVisible();

  await page.getByLabel("View workspace as").selectOption("jamie@agencyos.local");
  await page.getByRole("link", { name: "My work", exact: true }).click();
  const entryRow = page.getByRole("row").filter({ hasText: "Payment orchestration implementation" });
  await expect(entryRow).toContainText("Approved");
});
