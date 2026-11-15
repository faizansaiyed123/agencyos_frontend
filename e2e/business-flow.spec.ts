import { expect, test } from "@playwright/test";

test("client → deal → proposal acceptance creates a project and milestones", async ({ page }) => {
  page.on("console", (message) => console.log("BROWSER CONSOLE", message.type(), message.text()));
  page.on("requestfailed", (request) => console.log("BROWSER REQUEST FAILED", request.method(), request.url(), request.failure()?.errorText));
  page.on("response", (response) => { if (response.url().includes("/api/v1/proposals")) console.log("PROPOSAL API RESPONSE", response.status(), response.url()); });
  const clientName = "Recruiter Workflow Studio";
  const dealName = "End-to-End Product Delivery";
  const proposalName = "Product Delivery Scope";
  const milestoneName = "Discovery and delivery planning";

  await page.goto("/clients");
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Name").fill(clientName);
  await page.getByLabel("Industry").fill("Software");
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("link", { name: clientName, exact: true })).toBeVisible();

  await page.goto("/deals");
  await page.getByRole("button", { name: "New deal" }).click();
  await page.getByLabel("Client").selectOption({ label: clientName });
  await page.getByLabel("Deal title").fill(dealName);
  await page.getByLabel("Value").fill("2500");
  await page.getByRole("button", { name: "Create deal" }).click();
  await expect(page.getByRole("link", { name: dealName, exact: true })).toBeVisible();
  await page.getByRole("link", { name: dealName, exact: true }).click();
  await expect(page.getByRole("heading", { name: dealName, level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "New proposal" }).click();
  await page.getByLabel("Proposal title").fill(proposalName);
  await page.getByRole("button", { name: "Create draft" }).click();
  console.log("PROPOSAL AFTER SUBMIT URL", page.url());
  console.log("PROPOSAL AFTER SUBMIT MAIN", (await page.locator("main").innerText()).slice(0, 1400));
  await expect(page.getByRole("heading", { name: proposalName })).toBeVisible();

  await page.getByRole("button", { name: "Add line item" }).click();
  await page.getByLabel("Description").fill(milestoneName);
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price").fill("2500");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(milestoneName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Send to client" }).click();
  await expect(page.getByRole("button", { name: "Mark accepted" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Mark accepted" }).click();
  await expect(page.getByText(/Accepted .* The deal was moved to Won\./)).toBeVisible();

  await page.goto("/deals");
  await page.getByRole("link", { name: dealName, exact: true }).click();
  await expect(page.getByText("Won", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("link", { name: dealName, exact: true }).click();
  await expect(page.getByRole("heading", { name: dealName })).toBeVisible();
  await page.getByRole("tab", { name: "Milestones" }).click();
  await expect(page.getByText(milestoneName, { exact: true })).toBeVisible();
});
