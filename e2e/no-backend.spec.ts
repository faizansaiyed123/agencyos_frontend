import { expect, test } from "@playwright/test";

test("all product screens remain usable without requests to a backend or external host", async ({ page }) => {
  await page.goto("/");
  const frontendOrigin = new URL(page.url()).origin;
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== frontendOrigin) externalRequests.push(request.url());
  });

  for (const path of [
    "/clients",
    "/deals",
    "/proposals",
    "/projects",
    "/work",
    "/invoices",
    "/reports",
    "/team",
    "/settings",
    "/security",
  ]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("No local API route matches");
  }

  await page.getByLabel("View workspace as").selectOption("client@agencyos.local");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Acme Global", level: 1 })).toBeVisible();

  expect(externalRequests).toEqual([]);
});
