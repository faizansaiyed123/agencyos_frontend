import { expect, test } from "@playwright/test";

test("privacy export covers personal records and erasure anonymises while retaining evidence", async ({ page }) => {
  await page.goto("/");

  const ownerExport = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    return await api("/privacy/export/me");
  });
  for (const section of [
    "profile",
    "time_entries",
    "comments",
    "assigned_tasks",
    "notifications",
    "approval_requests",
    "files_uploaded",
    "audit_trail",
  ]) {
    expect(ownerExport).toHaveProperty(section);
  }

  const seeded = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    const projects = await api("/projects", { query: { limit: 100 } });
    const users = await api("/users", { query: { limit: 100 } });
    return {
      project: projects.items.find((project) => project.status === "active"),
      teammate: users.items.find((user) => user.email === "jamie@agencyos.local"),
    };
  });
  expect(seeded.project).toBeTruthy();
  expect(seeded.teammate).toBeTruthy();

  await page.getByLabel("View workspace as").selectOption("jamie@agencyos.local");
  await page.evaluate(async ({ projectId }) => {
    const { api } = await import("/src/api/client.ts");
    await api("/comments", {
      body: {
        entity_type: "project",
        entity_id: projectId,
        body: "Personal comment text that should be removed during erasure.",
      },
    });
  }, { projectId: seeded.project.id });

  await page.getByLabel("View workspace as").selectOption("owner@agencyos.local");
  await page.evaluate(async ({ projectId, approverId }) => {
    const { api } = await import("/src/api/client.ts");
    await api("/approvals", {
      body: {
        entity_type: "project",
        entity_id: projectId,
        approver_id: approverId,
        title: "Privacy erasure approval audit",
      },
    });
  }, { projectId: seeded.project.id, approverId: seeded.teammate.id });

  await page.getByLabel("View workspace as").selectOption("jamie@agencyos.local");
  const before = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    return await api("/privacy/export/me");
  });
  expect(before.comments.some((comment) => comment.body.includes("Personal comment text"))).toBe(true);
  expect(before.assigned_tasks.some((task) => task.title === "Implement payment orchestration")).toBe(true);
  expect(before.notifications.some((notification) => notification.title === "Privacy erasure approval audit")).toBe(true);
  expect(before.approval_requests.some((approval) => approval.title === "Privacy erasure approval audit")).toBe(true);
  expect(before.time_entries.length).toBeGreaterThan(0);

  await page.getByLabel("View workspace as").selectOption("owner@agencyos.local");
  const erased = await page.evaluate(async (userId) => {
    const { api } = await import("/src/api/client.ts");
    return await api("/privacy/erase/" + userId, { method: "POST" });
  }, seeded.teammate.id);
  expect(erased).toMatchObject({ user_id: seeded.teammate.id, erased: true });
  expect(erased.retained).toContain("time entries (billing evidence)");

  const after = await page.evaluate(async (userId) => {
    const { api } = await import("/src/api/client.ts");
    return await api("/privacy/export/" + userId);
  }, seeded.teammate.id);
  expect(after.profile.full_name).toBe("Erased user");
  expect(after.profile.email).toMatch(/@erased\.invalid$/);
  expect(after.comments.some((comment) => comment.body === "[removed on request]")).toBe(true);
  expect(after.notifications).toHaveLength(0);
  expect(after.assigned_tasks).toHaveLength(0);
  expect(after.time_entries).toHaveLength(before.time_entries.length);
});
