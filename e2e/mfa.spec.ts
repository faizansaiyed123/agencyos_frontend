import { expect, test } from "@playwright/test";

test("authenticator enrollment and sign-in use time-based one-time passwords", async ({ page }) => {
  await page.goto("/security");
  await page.getByRole("button", { name: "Set up two-factor" }).click();

  const secret = await page.locator("code.secret").innerText();
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  const invalidCode = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    try {
      await api("/auth/mfa/enroll/confirm", { body: { code: "not-a-code" } });
      return null;
    } catch (error) {
      return { status: error.status, code: error.code };
    }
  });
  expect(invalidCode).toMatchObject({ status: 422, code: "invalid_mfa_code" });

  const code = await page.evaluate(async (key) => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let buffer = 0;
    let bits = 0;
    const bytes = [];
    for (const char of key) {
      buffer = (buffer << 5) | alphabet.indexOf(char);
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 255);
        buffer &= (1 << bits) - 1;
      }
    }
    const counter = BigInt(Math.floor(Date.now() / 30000));
    const message = new Uint8Array(8);
    for (let index = 7; index >= 0; index--) {
      message[index] = Number((counter >> BigInt((7 - index) * 8)) & 255n);
    }
    const hmacKey = await crypto.subtle.importKey(
      "raw", new Uint8Array(bytes), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, message));
    const offset = digest[digest.length - 1] & 15;
    const binary = ((digest[offset] & 127) << 24) |
      ((digest[offset + 1] & 255) << 16) |
      ((digest[offset + 2] & 255) << 8) |
      (digest[offset + 3] & 255);
    return String(binary % 1000000).padStart(6, "0");
  }, secret);

  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Confirm and turn on" }).click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();
  await expect(page.locator(".codes span")).toHaveCount(10);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("owner@agencyos.local");
  await page.getByLabel("Password").fill("workspace-access");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Two-factor code" })).toBeVisible();

  const loginCode = await page.evaluate(async (key) => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let buffer = 0;
    let bits = 0;
    const bytes = [];
    for (const char of key) {
      buffer = (buffer << 5) | alphabet.indexOf(char);
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 255);
        buffer &= (1 << bits) - 1;
      }
    }
    const counter = BigInt(Math.floor(Date.now() / 30000));
    const message = new Uint8Array(8);
    for (let index = 7; index >= 0; index--) {
      message[index] = Number((counter >> BigInt((7 - index) * 8)) & 255n);
    }
    const hmacKey = await crypto.subtle.importKey("raw", new Uint8Array(bytes), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, message));
    const offset = digest[digest.length - 1] & 15;
    const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) | ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
    return String(binary % 1000000).padStart(6, "0");
  }, secret);
  await page.getByLabel("Code").fill(loginCode);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.locator(".me")).toContainText("Morgan Chen");

  const disableAttempt = await page.evaluate(async (code) => {
    const { api } = await import("/src/api/client.ts");
    try {
      await api("/auth/mfa/disable", { body: { password: "invalid-local-test-value", code } });
      return { rejected: false, status: 200 };
    } catch (error) {
      return { rejected: true, status: error.status, code: error.code };
    }
  }, loginCode);
  expect(disableAttempt).toMatchObject({
    rejected: true,
    status: 401,
    code: "invalid_credentials",
  });
  await page.goto("/security");
  await expect(page.getByText("On", { exact: true })).toBeVisible();
});
