import { expect, test } from "@playwright/test";

test("time tracking and invoice settlement work without an API server", async ({ page }) => {
  const projectName = "Payment Platform Modernization";
  const activity = "Recruiter verification session";
  await page.goto("/work");

  await page.getByLabel("Project").selectOption({ label: projectName });
  await page.getByLabel("What are you working on?").fill(activity);
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText(activity, { exact: true })).toBeVisible();

  await page.goto("/invoices");
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByLabel("Client").selectOption({ label: "Acme Global" });
  await page.getByLabel("Project").selectOption({ label: projectName });
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: "Draft invoice" })).toBeVisible();

  await page.getByRole("button", { name: "Add line" }).first().click();
  await page.getByLabel("Description").fill("Recruiter workflow verification");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price").fill("250");
  await page.getByRole("button", { name: "Add line" }).last().click();
  await expect(page.getByText("Recruiter workflow verification", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Record payment" }).first().click();
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Record payment" }).last().click();
  await expect(page.getByText("Partially paid", { exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^INV-.*\.pdf$/);
});
