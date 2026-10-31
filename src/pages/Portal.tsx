import { useState } from "react";
import { api, apiBlob } from "../api/client";
import { useAction, usePortalOverview, usePortalProposal } from "../api/hooks";
import { Empty, ErrorNote, PageHead, Spinner, StatusBadge } from "../components/ui";
import { fmtDate, label, money } from "../lib";
import type { ProposalStatus } from "../api/types";

function ProposalCard({
  title,
  status,
  currency,
  total,
  validUntil,
  onOpen,
}: {
  title: string;
  status: ProposalStatus;
  currency: string;
  total: number;
  validUntil: string | null;
  onOpen: () => void;
}) {
  return (
    <button className="portal-card" onClick={onOpen}>
      <div className="portal-card-head">
        <strong>{title}</strong>
        <StatusBadge status={status} />
      </div>
      <div className="portal-card-value">{money(total, currency)}</div>
      <div className="muted">
        {validUntil ? `Valid until ${fmtDate(validUntil)}` : "No expiry date"}
      </div>
    </button>
  );
}

export default function Portal() {
  const q = usePortalOverview();
  const [selected, setSelected] = useState<string | null>(null);
  const detail = usePortalProposal(selected);
  const decide = useAction(
    ({ id, decision, reason }: { id: string; decision: "accept" | "reject"; reason?: string }) =>
      api(`/portal/proposals/${id}/${decision}`, {
        method: "POST",
        body: decision === "reject" ? { reason } : undefined,
      }),
    ["portal-overview", "portal-proposals", "portal-proposal"],
  );

  if (q.isLoading) return <Spinner />;
  if (!q.data)
    return (
      <Empty title="Portal unavailable">Your client relationship is not configured yet.</Empty>
    );

  const { client, projects, proposals, invoices } = q.data;
  const openProposals = proposals.filter((p) => p.status === "sent");
  const outstanding = invoices.reduce((sum, i) => sum + i.balance_cents, 0);
  const downloadInvoice = async (id: string, number: string | null) => {
    const blob = await apiBlob(`/portal/invoices/${id}/pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${number ?? "invoice"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead
        title={client.name}
        sub="A clear view of your active work, proposals and invoices."
      />
      <div className="portal-hero">
        <div>
          <div className="eyebrow">Client portal</div>
          <h2>{client.name}</h2>
          <p>{client.industry || "Your AgencyOS workspace"}</p>
        </div>
        <div className="portal-hero-stats">
          <span>
            <b>{projects.length}</b> projects
          </span>
          <span>
            <b>{openProposals.length}</b> proposals to review
          </span>
          <span>
            <b>{money(outstanding)}</b> outstanding
          </span>
        </div>
      </div>

      <div className="portal-grid">
        <section className="panel">
          <header>
            <h3>Proposals</h3>
            <span className="muted">{proposals.length}</span>
          </header>
          <div className="body">
            {!proposals.length ? (
              <Empty title="Nothing to review">
                New proposals will appear here when your agency sends them.
              </Empty>
            ) : (
              <div className="portal-stack">
                {proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    title={p.title}
                    status={p.status}
                    currency={p.currency}
                    total={p.total_amount}
                    validUntil={p.valid_until}
                    onOpen={() => setSelected(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <header>
            <h3>Projects</h3>
            <span className="muted">{projects.length}</span>
          </header>
          <div className="body">
            {!projects.length ? (
              <Empty title="No projects yet">Accepted work will appear here.</Empty>
            ) : (
              <div className="portal-list">
                {projects.map((p) => (
                  <div className="portal-row" key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <div className="muted">{p.description || "Project"}</div>
                    </div>
                    <div className="right-stack">
                      <span className="badge blue">{label(p.status)}</span>
                      {p.due_date && <span className="muted">{fmtDate(p.due_date)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <header>
            <h3>Invoices</h3>
            <span className="muted">{invoices.length}</span>
          </header>
          <div className="body">
            {!invoices.length ? (
              <Empty title="No invoices yet">Issued invoices will appear here.</Empty>
            ) : (
              <div className="portal-list">
                {invoices.map((i) => (
                  <div className="portal-row" key={i.id}>
                    <div>
                      <strong>{i.number || "Invoice"}</strong>
                      <div className="muted">
                        {i.due_date ? `Due ${fmtDate(i.due_date)}` : "No due date"}
                      </div>
                    </div>
                    <div className="right-stack">
                      <span
                        className={`badge ${i.status === "paid" ? "moss" : i.balance_cents > 0 ? "sun" : ""}`}
                      >
                        {label(i.status)}
                      </span>
                      <strong>{money(i.balance_cents, i.currency)}</strong>
                      <button
                        className="btn sm ghost"
                        onClick={() => downloadInvoice(i.id, i.number)}
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {selected && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setSelected(null);
          }}
        >
          <div
            className="modal portal-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Proposal details"
          >
            {detail.isLoading ? (
              <Spinner />
            ) : !detail.data ? (
              <Empty title="Proposal unavailable" />
            ) : (
              <>
                <div className="modal-head-row">
                  <div>
                    <div className="eyebrow">Proposal</div>
                    <h2>{detail.data.proposal.title}</h2>
                  </div>
                  <button className="btn ghost" onClick={() => setSelected(null)}>
                    Close
                  </button>
                </div>
                <div className="portal-total">
                  {money(detail.data.proposal.total_amount, detail.data.proposal.currency)}
                </div>
                <div className="portal-items">
                  {detail.data.items.map((item) => (
                    <div className="portal-row" key={item.id}>
                      <div>
                        <strong>{item.description}</strong>
                        <div className="muted">
                          {item.quantity} ×{" "}
                          {money(item.unit_amount, detail.data!.proposal.currency)}
                        </div>
                      </div>
                      <strong>{money(item.amount, detail.data.proposal.currency)}</strong>
                    </div>
                  ))}
                </div>
                {detail.data.proposal.rejection_reason && (
                  <div className="notice">
                    Previous response: {detail.data.proposal.rejection_reason}
                  </div>
                )}
                <ErrorNote error={decide.error} />
                {detail.data.proposal.status === "sent" && (
                  <div className="actions">
                    <button
                      className="btn danger"
                      disabled={decide.isPending}
                      onClick={() => {
                        const reason = window.prompt("What would you like changed?");
                        if (reason?.trim())
                          decide.mutate({
                            id: detail.data!.proposal.id,
                            decision: "reject",
                            reason: reason.trim(),
                          });
                      }}
                    >
                      Request changes
                    </button>
                    <button
                      className="btn primary"
                      disabled={decide.isPending}
                      onClick={() => {
                        if (window.confirm("Accept this proposal and start the project?")) {
                          decide.mutate({ id: detail.data!.proposal.id, decision: "accept" });
                        }
                      }}
                    >
                      {decide.isPending ? "Saving…" : "Accept proposal"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
