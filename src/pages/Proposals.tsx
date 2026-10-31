import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAction, useClients, useDeals, useProposal, useProposals } from "../api/hooks";
import { can } from "../api/permissions";
import type { Proposal, ProposalItem } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { CommentsPanel, FilesPanel, RequestApproval } from "../components/Collab";
import {
  Empty,
  ErrorNote,
  Field,
  FormModal,
  PageHead,
  Spinner,
  StatusBadge,
} from "../components/ui";
import { fmtDate, fromCents, lineTotal, money, toCents } from "../lib";

function NewProposal({ presetDeal, onClose }: { presetDeal?: string; onClose: () => void }) {
  const deals = useDeals();
  const nav = useNavigate();
  const open = (deals.data?.items ?? []).filter((d) => d.stage !== "lost");
  const [dealId, setDealId] = useState(presetDeal ?? "");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const deal = open.find((d) => d.id === dealId);
  const create = useAction(
    () =>
      api<Proposal>("/proposals", {
        body: {
          client_id: deal!.client_id,
          deal_id: deal!.id,
          title,
          currency: deal!.value_currency,
          valid_until: validUntil || null,
        },
      }),
    ["proposals"],
  );
  return (
    <FormModal
      title="New proposal"
      submitLabel="Create draft"
      onClose={onClose}
      onSubmit={async () => {
        const p = await create.mutateAsync(undefined);
        nav(`/proposals/${(p as Proposal).id}`);
      }}
    >
      <Field label="Deal">
        <select value={dealId} onChange={(e) => setDealId(e.target.value)} required>
          <option value="">Choose a deal…</option>
          {open.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Proposal title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </Field>
      <Field label="Valid until" hint="After this date a sent proposal expires automatically.">
        <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
      </Field>
    </FormModal>
  );
}

export function Proposals() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState("");
  const q = useProposals(status ? { status } : {});
  const clients = useClients(true);
  const [creating, setCreating] = useState(params.has("new"));
  const canManage = can(user?.role, "proposal:manage");
  const clientName = (id: string) => clients.data?.items.find((c) => c.id === id)?.name ?? "—";
  return (
    <>
      <PageHead
        title="Proposals"
        sub="Priced scopes of work you send to clients."
        actions={
          <>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="">All statuses</option>
              {["draft", "sent", "accepted", "rejected", "expired"].map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            {canManage && (
              <button className="btn primary" onClick={() => setCreating(true)}>
                New proposal
              </button>
            )}
          </>
        }
      />
      <div className="panel">
        {q.isLoading ? (
          <Spinner />
        ) : q.error ? (
          <div className="body">
            <ErrorNote error={q.error} />
          </div>
        ) : !q.data?.items.length ? (
          <Empty title="No proposals">
            {canManage ? "Create one from a deal." : "Nothing to show."}
          </Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Proposal</th>
                <th>Client</th>
                <th>Status</th>
                <th>Valid until</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((p) => (
                <tr key={p.id} className="link">
                  <td>
                    <Link to={`/proposals/${p.id}`}>
                      <strong>{p.title}</strong>
                    </Link>
                  </td>
                  <td>{clientName(p.client_id)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="muted">{fmtDate(p.valid_until)}</td>
                  <td className="muted">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && (
        <NewProposal
          presetDeal={params.get("new") ?? undefined}
          onClose={() => {
            setCreating(false);
            setParams({});
          }}
        />
      )}
    </>
  );
}

function ItemForm({
  proposalId,
  initial,
  onClose,
}: {
  proposalId: string;
  initial?: ProposalItem;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    description: initial?.description ?? "",
    quantity: initial?.quantity ?? "1",
    unit: fromCents(initial?.unit_amount),
  });
  const save = useAction(() => {
    const body = { description: f.description, quantity: f.quantity, unit_amount: toCents(f.unit) };
    return initial
      ? api(`/proposal-items/${initial.id}`, { method: "PATCH", body })
      : api(`/proposals/${proposalId}/items`, { body });
  }, ["proposal"]);
  return (
    <FormModal
      title={initial ? "Edit line item" : "Add line item"}
      submitLabel={initial ? "Save changes" : "Add item"}
      onClose={onClose}
      onSubmit={() => save.mutateAsync(undefined)}
    >
      <Field label="Description">
        <input
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid2">
        <Field label="Quantity">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={f.quantity}
            onChange={(e) => setF({ ...f, quantity: e.target.value })}
            required
          />
        </Field>
        <Field label="Unit price">
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.unit}
            onChange={(e) => setF({ ...f, unit: e.target.value })}
            required
          />
        </Field>
      </div>
    </FormModal>
  );
}

export function ProposalDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const q = useProposal(id);
  const clients = useClients(true);
  const [item, setItem] = useState<ProposalItem | "new" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const inv = ["proposal", "proposals", "deals", "deal", "deal-history"];
  const send = useAction(() => api(`/proposals/${id}/send`, { method: "POST" }), inv);
  const accept = useAction(() => api(`/proposals/${id}/accept`, { method: "POST" }), inv);
  const reject = useAction(() => api(`/proposals/${id}/reject`, { body: { reason } }), inv);
  const remove = useAction(
    (iid: string) => api(`/proposal-items/${iid}`, { method: "DELETE" }),
    ["proposal"],
  );

  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data)
    return (
      <>
        <ErrorNote error={q.error} />
        <Link to="/proposals">Back to proposals</Link>
      </>
    );
  const { proposal: p, items, total_amount } = q.data;
  const draft = p.status === "draft";
  const canManage = can(user?.role, "proposal:manage");
  const client = clients.data?.items.find((c) => c.id === p.client_id);

  return (
    <>
      <PageHead
        crumb={<Link to="/proposals">Proposals</Link>}
        title={p.title}
        sub={client?.name}
        actions={
          <>
            <StatusBadge status={p.status} />
            <RequestApproval type="proposal" id={p.id} title={p.title} />
            {canManage && draft && (
              <button
                className="btn primary"
                disabled={send.isPending || !items.length}
                onClick={() => send.mutate(undefined)}
              >
                Send to client
              </button>
            )}
            {canManage && p.status === "sent" && (
              <>
                <button
                  className="btn primary"
                  disabled={accept.isPending}
                  onClick={() => {
                    if (confirm("Mark as accepted? The linked deal will move to Won."))
                      accept.mutate(undefined);
                  }}
                >
                  Mark accepted
                </button>
                <button className="btn danger" onClick={() => setRejecting(true)}>
                  Mark rejected
                </button>
              </>
            )}
          </>
        }
      />
      <ErrorNote error={send.error ?? accept.error ?? remove.error} />
      {draft && !items.length && canManage && (
        <div className="notice">Add at least one line item before sending.</div>
      )}
      {p.status === "accepted" && (
        <div className="notice">Accepted {fmtDate(p.accepted_at)}. The deal was moved to Won.</div>
      )}
      {p.status === "rejected" && (
        <div className="error">
          Rejected {fmtDate(p.rejected_at)}: {p.rejection_reason}
        </div>
      )}
      <div className="cols">
        <div className="panel">
          <header>
            <h3>Scope and pricing</h3>
            {canManage && draft && (
              <button className="btn sm ghost" onClick={() => setItem("new")}>
                Add line item
              </button>
            )}
          </header>
          {!items.length ? (
            <Empty title="No line items yet" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit</th>
                  <th className="num">Amount</th>
                  {canManage && draft && <th />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.description}</td>
                    <td className="num">{parseFloat(it.quantity)}</td>
                    <td className="num">{money(it.unit_amount, p.currency)}</td>
                    <td className="num">
                      {money(lineTotal(it.quantity, it.unit_amount), p.currency)}
                    </td>
                    {canManage && draft && (
                      <td className="num">
                        <button className="btn sm ghost" onClick={() => setItem(it)}>
                          Edit
                        </button>{" "}
                        <button className="btn sm danger" onClick={() => remove.mutate(it.id)}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="num">
                    <strong>Total</strong>
                  </td>
                  <td className="num">
                    <strong>{money(total_amount, p.currency)}</strong>
                  </td>
                  {canManage && draft && <td />}
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>Details</h3>
            </header>
            <div className="body">
              <dl className="facts">
                <dt>Deal</dt>
                <dd>
                  <Link to={`/deals/${p.deal_id}`}>View deal</Link>
                </dd>
                <dt>Currency</dt>
                <dd>{p.currency}</dd>
                <dt>Valid until</dt>
                <dd>{fmtDate(p.valid_until)}</dd>
                <dt>Sent</dt>
                <dd>{fmtDate(p.sent_at)}</dd>
                <dt>Created</dt>
                <dd>{fmtDate(p.created_at)}</dd>
              </dl>
              {!draft && (
                <p className="muted" style={{ marginBottom: 0 }}>
                  Line items are locked once a proposal is sent.
                </p>
              )}
            </div>
          </div>
          <FilesPanel type="proposal" id={p.id} />
          <CommentsPanel type="proposal" id={p.id} />
        </div>
      </div>
      {item && (
        <ItemForm
          proposalId={id}
          initial={item === "new" ? undefined : item}
          onClose={() => setItem(null)}
        />
      )}
      {rejecting && (
        <FormModal
          title="Reject proposal"
          submitLabel="Mark rejected"
          danger
          onClose={() => setRejecting(false)}
          onSubmit={() => reject.mutateAsync(undefined)}
        >
          <Field label="Reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              autoFocus
            />
          </Field>
        </FormModal>
      )}
    </>
  );
}
