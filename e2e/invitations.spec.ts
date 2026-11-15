import { expect, test } from "@playwright/test";

async function acceptInvitation(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("link", { name: "Open invite" }).click();
  await expect(page).toHaveURL(/\/accept-invite\?token=/);
  await page.getByRole("button", { name: "Sign out and continue" }).click();
  await expect(page.getByRole("heading", { name: "Join your team" })).toBeVisible();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Password").fill("RecruiterPass2026");
  await page.getByRole("button", { name: "Accept invite" }).click();
  await expect(page.locator(".me")).toContainText(name);
}

test("staff invitation can be created, accepted once, and signed into", async ({ page }) => {
  const email = "new.engineer@agencyos.local";
  await page.goto("/team");
  await page.getByRole("button", { name: "Invite teammate" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption("team_member");
  await page.getByRole("button", { name: "Send invite" }).click();

  const inviteRow = page.getByRole("row").filter({ hasText: email });
  await expect(inviteRow).toBeVisible();
  await acceptInvitation(page, "New Engineer");
  const staffUser = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    return await api("/auth/me");
  });
  expect(staffUser).toMatchObject({ email, role: "team_member" });

  await expect(page.getByRole("link", { name: "My work", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".me")).toContainText("New Engineer");
});

test("client invitation is bound to its client and opens only the client portal", async ({ page }) => {
  const email = "client.reviewer@agencyos.local";
  await page.goto("/team");
  await page.getByRole("button", { name: "Invite teammate" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption("client");
  await page.getByLabel("Client account").selectOption({ label: "Acme Global" });
  await page.getByRole("button", { name: "Send invite" }).click();

  const inviteRow = page.getByRole("row").filter({ hasText: email });
  await expect(inviteRow).toBeVisible();
  await page.getByRole("link", { name: "Open invite" }).click();
  await page.getByRole("button", { name: "Sign out and continue" }).click();
  await page.getByLabel("Your name").fill("Client Reviewer");
  await page.getByLabel("Password").fill("RecruiterPass2026");
  await page.getByRole("button", { name: "Accept invite" }).click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Acme Global", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clients", exact: true })).toHaveCount(0);
  const clientUser = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    return await api("/auth/me");
  });
  expect(clientUser).toMatchObject({ email, role: "client" });
});

test("role management enforces owner and client-role rules", async ({ page }) => {
  await page.goto("/");
  const ownerChecks = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    const users = await api("/users");
    const owner = users.items.find((user) => user.role === "owner");
    const tryRequest = async (id, new_role) => {
      try {
        await api("/users/" + id + "/role", { method: "POST", query: { new_role } });
        return { allowed: true, status: 200 };
      } catch (error) {
        return { allowed: false, status: error.status, code: error.code };
      }
    };
    return {
      lastOwner: await tryRequest(owner.id, "team_member"),
      clientRole: await tryRequest(owner.id, "client"),
    };
  });
  expect(ownerChecks.lastOwner).toMatchObject({ allowed: false, status: 409, code: "last_owner" });
  expect(ownerChecks.clientRole).toMatchObject({ allowed: false, status: 403, code: "forbidden" });

  await page.getByLabel("View workspace as").selectOption("admin@agencyos.local");
  const adminChecks = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    const users = await api("/users");
    const owner = users.items.find((user) => user.role === "owner");
    try {
      await api("/users/" + owner.id + "/role", { method: "POST", query: { new_role: "owner" } });
      return { allowed: true };
    } catch (error) {
      return { allowed: false, status: error.status };
    }
  });
  expect(adminChecks).toEqual({ allowed: false, status: 403 });
});
