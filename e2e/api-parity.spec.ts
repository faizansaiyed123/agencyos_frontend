import { expect, test } from "@playwright/test";

test("local APIs keep client-portal data private and require valid credentials", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const { withDemoState } = await import("/src/demo/store.ts");
    const ids = await withDemoState((state) => {
      const clientUser = state.users.find((user) => user.role === "client");
      const starlight = state.clients.find((client) => client.name === "Starlight Interactive");
      const draftProposal = state.proposals.find((proposal) =>
        proposal.client_id === starlight.id && proposal.status === "draft"
      );
      const draftInvoice = state.invoices.find((invoice) =>
        invoice.client_id === starlight.id && invoice.status === "draft"
      );
      clientUser.client_id = starlight.id;
      state.activeUserId = clientUser.id;
      return {
        ownerId: state.users.find((user) => user.role === "owner").id,
        draftProposalId: draftProposal.id,
        draftInvoiceId: draftInvoice.id,
      };
    });

    const { api } = await import("/src/api/client.ts");
    const overview = await api("/portal/overview");
    const proposals = await api("/portal/proposals");
    const invoices = await api("/portal/invoices");
    let draftDetailStatus = 0;
    try {
      await api("/portal/proposals/" + ids.draftProposalId);
    } catch (error) {
      draftDetailStatus = error.status;
    }
    let staffPortalStatus = 0;
    await withDemoState((state) => {
      state.activeUserId = ids.ownerId;
    });
    try {
      await api("/portal/projects");
    } catch (error) {
      staffPortalStatus = error.status;
    }
    let badPasswordStatus = 0;
    try {
      await api("/auth/login", {
        body: { email: "owner@agencyos.local", password: "DefinitelyWrong2026" },
      });
    } catch (error) {
      badPasswordStatus = error.status;
    }
    return {
      overviewProposalCount: overview.proposals.length,
      overviewInvoiceCount: overview.invoices.length,
      proposals: proposals.length,
      invoices: invoices.length,
      draftDetailStatus,
      staffPortalStatus,
      badPasswordStatus,
      draftInvoiceId: ids.draftInvoiceId,
    };
  });

  expect(result.overviewProposalCount).toBe(0);
  expect(result.overviewInvoiceCount).toBe(0);
  expect(result.proposals).toBe(0);
  expect(result.invoices).toBe(0);
  expect(result.draftDetailStatus).toBe(404);
  expect(result.staffPortalStatus).toBe(403);
  expect(result.badPasswordStatus).toBe(401);
});
