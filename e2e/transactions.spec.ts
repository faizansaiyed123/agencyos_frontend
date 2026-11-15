import { expect, test } from "@playwright/test";

test("failed local API transactions leave the persisted workspace unchanged", async ({ page }) => {
  await page.goto("/");

  const before = await page.evaluate(async () => {
    const { getDemoState } = await import("/src/demo/store.ts");
    const state = await getDemoState();
    return state.clients[0].name;
  });

  const afterFailure = await page.evaluate(async () => {
    const { withDemoState, getDemoState } = await import("/src/demo/store.ts");
    let rejected = false;
    try {
      await withDemoState((state) => {
        state.clients[0].name = "This partial mutation must roll back";
        throw new Error("simulated transaction failure");
      });
    } catch {
      rejected = true;
    }
    const state = await getDemoState();
    return { rejected, name: state.clients[0].name };
  });

  expect(afterFailure).toEqual({ rejected: true, name: before });
  await page.reload();
  const afterReload = await page.evaluate(async () => {
    const { getDemoState } = await import("/src/demo/store.ts");
    const state = await getDemoState();
    return state.clients[0].name;
  });
  expect(afterReload).toBe(before);
});
