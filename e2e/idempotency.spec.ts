import { expect, test } from "@playwright/test";

test("idempotency keys replay a payment once and reject changed payloads", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { api } = await import("/src/api/client.ts");
    const invoiceId = "00000000-0000-4000-8000-000000000502";
    const key = "recruiter-idempotency-key";
    const body = {
      amount_cents: 1,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "other",
      reference: "RECRUITER-IDEMPOTENCY",
    };
    const first = await api("/invoices/" + invoiceId + "/payments", {
      body,
      headers: { "Idempotency-Key": key },
    });
    const replay = await api("/invoices/" + invoiceId + "/payments", {
      body,
      headers: { "Idempotency-Key": key },
    });
    let conflict = false;
    try {
      await api("/invoices/" + invoiceId + "/payments", {
        body: { ...body, amount_cents: 2 },
        headers: { "Idempotency-Key": key },
      });
    } catch (error) {
      conflict = error.status === 409 && error.code === "idempotency_key_conflict";
    }
    const detail = await api("/invoices/" + invoiceId);
    const matches = detail.payments.filter((payment) => payment.reference === body.reference);
    return { firstId: first.id, replayId: replay.id, conflict, matchingPayments: matches.length };
  });

  expect(result.firstId).toBe(result.replayId);
  expect(result.conflict).toBe(true);
  expect(result.matchingPayments).toBe(1);
});
