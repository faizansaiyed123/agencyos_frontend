import { expect, test } from "@playwright/test";

test("reports, indexed search, keyword assistant, and privacy export use current workspace records", async ({ page }) => {
  const title = "Insights Pipeline Win " + Date.now();
  const titleSearch = "Insights Pipeline Win";
  await page.goto("/");
  const created = await page.evaluate(async ({ title, titleSearch }) => {
    const { api } = await import("/src/api/client.ts");
    const clients = await api("/clients", { query: { limit: 100 } });
    const client = clients.items[0];
    const deal = await api("/deals", {
      body: {
        client_id: client.id,
        title,
        description: "Created to validate dynamic reports and search.",
        value_amount: 13579,
        value_currency: "USD",
      },
    });
    for (const to_stage of ["qualified", "proposal_sent", "negotiation", "won"]) {
      await api("/deals/" + deal.id + "/stage", { body: { to_stage } });
    }

    const projects = await api("/projects", { query: { limit: 100 } });
    const project = projects.items.find((item) => item.status !== "completed" && item.status !== "cancelled");
    const time = await api("/time/entries", {
      body: {
        project_id: project.id,
        entry_date: new Date().toISOString().slice(0, 10),
        minutes: 45,
        description: "Reports and utilisation verification",
        billable: true,
      },
    });
    const overview = await api("/reports/overview");
    const pipeline = await api("/reports/pipeline");
    const utilization = await api("/reports/utilization");
    const search = await api("/search", { query: { q: titleSearch } });
    const attention = await api("/reports/attention");
    return {
      dealId: deal.id,
      timeId: time.id,
      wonValue: overview.won_ytd_cents,
      wonStage: pipeline.stages.find((stage) => stage.stage === "won"),
      utilization: utilization.find((row) => row.user_id === time.user_id),
      search,
      attention,
      outstanding: overview.outstanding_cents,
    };
  }, { title, titleSearch });

  expect(created.wonValue).toBeGreaterThanOrEqual(13579);
  expect(created.wonStage.value_cents).toBeGreaterThanOrEqual(13579);
  expect(created.utilization.minutes).toBeGreaterThanOrEqual(45);
  expect(created.utilization.billable_minutes).toBeGreaterThanOrEqual(45);
  expect(created.search.some((hit) => hit.title === title)).toBe(true);
  expect(created.attention.some((item) => item.kind === "overdue_invoice")).toBe(true);
  expect(created.outstanding).toBeGreaterThan(0);

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Invoiced vs collected")).toBeVisible();
  await expect(page.getByText("Team utilisation, last 30 days")).toBeVisible();
  await page.getByLabel("Period").selectOption("6");

  await page.goto("/");
  const searchBox = page.getByLabel("Search");
  await searchBox.fill(titleSearch);
  await expect(page.getByRole("button", { name: new RegExp(titleSearch) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(titleSearch) }).click();
  await expect(page).toHaveURL(new RegExp("/deals/" + created.dealId));

  await page.goto("/");
  await searchBox.fill("overdue invoices");
  await page.getByRole("button", { name: /Ask:/ }).click();
  await expect(page.getByText(/Overdue invoice/)).toBeVisible();

  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export my data" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("agencyos-data-me.json");
});
