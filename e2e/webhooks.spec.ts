import { expect, test } from "@playwright/test";

test("webhook subscriptions record matching local events without sending requests", async ({ page }) => {
  const endpoint = "https://hooks.example.test/agencyos";
  await page.goto("/settings");

  await page.getByRole("button", { name: "Add endpoint" }).click();
  await page.getByLabel("HTTPS URL").fill(endpoint);
  await page.getByRole("button", { name: "Create endpoint" }).click();
  await expect(page.getByRole("heading", { name: "Signing secret" })).toBeVisible();
  await expect(page.getByText(/^whsec_/)).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(endpoint, { exact: true })).toBeVisible();

  await page.goto("/invoices");
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByLabel("Client").selectOption({ label: "Acme Global" });
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: "Draft invoice" })).toBeVisible();

  await page.goto("/settings");
  const endpointRow = page.getByRole("row").filter({ hasText: endpoint });
  await endpointRow.getByRole("button", { name: "Deliveries" }).click();
  await expect(page.getByText("invoice.created", { exact: true })).toBeVisible();
  await expect(page.getByText("Local event", { exact: true })).toBeVisible();
  await expect(page.getByText("Not sent outside this browser", { exact: true })).toBeVisible();
});
