import { expect, test } from "@playwright/test";

test("each workspace persona receives its own navigation and access scope", async ({ page }) => {
  await page.goto("/");
  const persona = page.getByLabel("View workspace as");

  await persona.selectOption("jamie@agencyos.local");
  await expect(page.locator(".me")).toContainText("Team member");
  await expect(page.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "My work", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Invoices", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pipeline", exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("link", { name: "Payment Platform Modernization", exact: true })).toBeVisible();

  await persona.selectOption("taylor@agencyos.local");
  await expect(page.locator(".me")).toContainText("Finance");
  await expect(page.getByRole("link", { name: "Invoices", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();

  await persona.selectOption("client@agencyos.local");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Acme Global", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clients", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Invoices", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Client portal", exact: true })).toBeVisible();

  await page.goto("/invoices");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
});
