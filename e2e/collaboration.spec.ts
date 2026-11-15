import { expect, test } from "@playwright/test";

test("project collaboration supports comments, file storage, and approvals", async ({ page }) => {
  const projectName = "Payment Platform Modernization";
  const comment = "Recruiter workspace review: delivery notes are ready.";
  const fileName = "recruiter-workflow-notes.txt";

  await page.goto("/projects");
  await page.getByRole("link", { name: projectName, exact: true }).click();
  await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();

  await page.getByLabel("Write a comment").fill(comment);
  await page.getByRole("button", { name: "Comment" }).click();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Files" }).click();
  const upload = page.locator('input[type="file"]');
  await upload.setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("AgencyOS browser workspace file attachment.\n"),
  });
  await expect(page.getByRole("button", { name: fileName })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: fileName }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(fileName);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: fileName })).toHaveCount(0);

  await page.getByRole("button", { name: /Request approval/ }).click();
  await page.getByLabel("Approver").selectOption({ label: "Sarah Lin" });
  await page.getByLabel("What needs approving").fill("Approve the project delivery review");
  await page.getByRole("button", { name: "Send request" }).click();

  await page.getByLabel("View workspace as").selectOption("sarah@agencyos.local");
  await page.getByRole("button", { name: /Notifications/ }).click();
  await expect(page.getByText("Approve the project delivery review", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Needs your decision")).toHaveCount(0);
});
