import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, apiBlob } from "../api/client";
import {
  useAction,
  useClients,
  useInvoice,
  useInvoices,
  useProject,
  useProjects,
  useUnbilled,
} from "../api/hooks";
import { can } from "../api/permissions";
import { useNames } from "../api/useNames";
import type { CreditNote, Invoice, InvoiceStatus, Payment, PaymentRefund } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { CommentsPanel, FilesPanel } from "../components/Collab";
import { Empty, ErrorNote, Field, FormModal, PageHead, Spinner } from "../components/ui";
import { bpsToPct, fmtDate, hours, label, money, toCents, todayISO } from "../lib";

const TONE: Record<InvoiceStatus, string> = {
  draft: "",
  sent: "blue",
  partially_paid: "sun",
  paid: "moss",
  credited: "moss",
  void: "brick",
};
export const InvoiceBadge = ({ inv }: { inv: Invoice }) => (
  <>
    <span className={`badge ${TONE[inv.status]}`}>{label(inv.status)}</span>
    {inv.is_overdue && (
      <>
        {" "}
        <span className="badge brick">Overdue</span>
      </>
    )}
  </>
);

function NewInvoice({ onClose }: { onClose: () => void }) {
  const clients = useClients();
  const projects = useProjects();
  const nav = useNavigate();
  const [f, setF] = useState({ client_id: "", project_id: "", tax: "0", due: "" });
  const mine = projects.data?.items.filter((p) => p.client_id === f.client_id) ?? [];
  const create = useAction(
    () =>
      api<Invoice>("/invoices", {
        body: {
          client_id: f.client_id,
          project_id: f.project_id || null,
          tax_rate_bps: Math.round(parseFloat(f.tax || "0") * 100),
          due_date: f.due || null,
        },
      }),
    ["invoices"],
  );
  return (
    <FormModal
      title="New invoice"
      submitLabel="Create draft"
      onClose={onClose}
      onSubmit={async () => {
        const i = (await create.mutateAsync(undefined)) as Invoice;
        nav(`/invoices/${i.id}`);
      }}
    >
      <Field label="Client">
        <select
          value={f.client_id}
          onChange={(e) => setF({ ...f, client_id: e.target.value, project_id: "" })}
          required
        >
          <option value="">Choose…</option>
          {clients.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Project" hint="Needed to bill tracked time or milestones.">
        <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
          <option value="">None</option>
          {mine.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid2">
        <Field label="Tax rate (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={f.tax}
            onChange={(e) => setF({ ...f, tax: e.target.value })}
          />
        </Field>
        <Field label="Due date" hint="Defaults to 30 days after issue.">
          <input
            type="date"
            min={todayISO()}
            value={f.due}
            onChange={(e) => setF({ ...f, due: e.target.value })}
          />
        </Field>
      </div>
    </FormModal>
  );
}

export function Invoices() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const q = useInvoices(status === "overdue" ? { overdue: true } : status ? { status } : {});
  const clients = useClients(true);
  const cname = (id: string) => clients.data?.items.find((c) => c.id === id)?.name ?? "—";
  return (
    <>
      <PageHead
        title="Invoices"
        sub="Bill approved time and milestones, then track what has been paid."
        actions={
          <>
            <select
              aria-label="Filter"
              style={{ width: "auto" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="overdue">Overdue</option>
              {["draft", "sent", "partially_paid", "paid", "credited", "void"].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            {can(user?.role, "invoice:manage") && (
              <button className="btn primary" onClick={() => setCreating(true)}>
                New invoice
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
          <Empty title="No invoices" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Status</th>
                <th>Due</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((i) => (
                <tr key={i.id} className="link">
                  <td>
                    <Link to={`/invoices/${i.id}`}>
                      <strong>{i.number ?? "Draft"}</strong>
                    </Link>
                  </td>
                  <td>{cname(i.client_id)}</td>
                  <td>
                    <InvoiceBadge inv={i} />
                  </td>
                  <td className="muted">{fmtDate(i.due_date)}</td>
                  <td className="num">{money(i.total_cents, i.currency)}</td>
                  <td className="num">
                    {i.status === "draft" || i.status === "void"
                      ? "—"
                      : money(i.balance_cents, i.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <NewInvoice onClose={() => setCreating(false)} />}
    </>
  );
}

function PaymentForm({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const [f, setF] = useState({
    amount: String(inv.balance_cents / 100),
    paid_on: todayISO(),
    method: "bank_transfer",
    reference: "",
  });
  const [key] = useState(() => crypto.randomUUID()); // one key per dialog: a double-click or retry cannot record twice
  const pay = useAction(
    () =>
      api(`/invoices/${inv.id}/payments`, {
        body: {
          amount_cents: toCents(f.amount),
          paid_on: f.paid_on,
          method: f.method,
          reference: f.reference || null,
        },
        headers: { "Idempotency-Key": key },
      }),
    ["invoice", "invoices", "overview", "attention"],
  );
  return (
    <FormModal
      title="Record a payment"
      submitLabel="Record payment"
      onClose={onClose}
      onSubmit={() => pay.mutateAsync(undefined)}
    >
      <p style={{ marginTop: 0 }}>
        Outstanding: <strong>{money(inv.balance_cents, inv.currency)}</strong>. Payments can't be
        edited once recorded.
      </p>
      <div className="grid2">
        <Field label="Amount">
          <input
            type="number"
            min="0.01"
            max={inv.balance_cents / 100}
            step="0.01"
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
            required
            autoFocus
          />
        </Field>
        <Field label="Received on">
          <input
            type="date"
            max={todayISO()}
            value={f.paid_on}
            onChange={(e) => setF({ ...f, paid_on: e.target.value })}
            required
          />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Method">
          <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {["bank_transfer", "card", "cash", "other"].map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference">
          <input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
      </div>
    </FormModal>
  );
}

function LineForm({ id, onClose }: { id: string; onClose: () => void }) {
  const [f, setF] = useState({ description: "", quantity: "1", unit: "" });
  const add = useAction(
    () =>
      api(`/invoices/${id}/lines`, {
        body: { description: f.description, quantity: f.quantity, unit_cents: toCents(f.unit) },
      }),
    ["invoice"],
  );
  return (
    <FormModal
      title="Add line"
      submitLabel="Add line"
      onClose={onClose}
      onSubmit={() => add.mutateAsync(undefined)}
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

export function InvoiceDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const names = useNames();
  const q = useInvoice(id);
  const clients = useClients(true);
  const inv = q.data?.invoice;
  const unbilled = useUnbilled(inv?.status === "draft" ? inv.project_id : null);
  const project = useProject(inv?.project_id ?? "");
  const [line, setLine] = useState(false);
  const [paying, setPaying] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [refundTarget, setRefundTarget] = useState<{
    payment: Payment;
    remainingCents: number;
  } | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const inv2 = ["invoice", "invoices", "unbilled", "time", "overview", "attention"];
  const issue = useAction(() => api(`/invoices/${id}/issue`, { method: "POST" }), inv2);
  const discard = useAction(() => api(`/invoices/${id}`, { method: "DELETE" }), inv2);
  const addTime = useAction(() => api(`/invoices/${id}/lines/time`, { body: {} }), inv2);
  const addMs = useAction(
    (mid: string) => api(`/invoices/${id}/lines/milestone`, { body: { milestone_id: mid } }),
    inv2,
  );
  const rmLine = useAction(
    (lid: string) => api(`/invoices/${id}/lines/${lid}`, { method: "DELETE" }),
    inv2,
  );
  const setMeta = useAction(
    (b: { due_date?: string; tax_rate_bps?: number }) =>
      api(`/invoices/${id}`, { method: "PATCH", body: b }),
    inv2,
  );
  const void_ = useAction(() => api(`/invoices/${id}/void`, { body: { reason } }), inv2);
  const email = useAction(
    () =>
      api(`/invoices/${id}/send`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    inv2,
  );
  const issueCreditNote = useAction(
    (body: { amount_cents: number; issued_on: string; reason: string }) =>
      api(`/invoices/${id}/credit-notes`, {
        body,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    [...inv2, "portal-credit-notes"],
  );
  const downloadPdf = async () => {
    const blob = await apiBlob(`/invoices/${id}/pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv?.number ?? "invoice"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data || !inv)
    return (
      <>
        <ErrorNote error={q.error} />
        <Link to="/invoices">Back to invoices</Link>
      </>
    );
  const { lines, payments, refunds, credit_notes: creditNotes } = q.data;
  const manage = can(user?.role, "invoice:manage");
  const draft = inv.status === "draft";
  const client = clients.data?.items.find((c) => c.id === inv.client_id);
  const unbilledTotal = unbilled.data?.reduce((s, r) => s + r.amount_cents, 0) ?? 0;
  const billableMs =
    project.data?.milestones.filter(
      (m) => m.amount_cents && !lines.some((l) => l.milestone_id === m.id),
    ) ?? [];
  const creditableCents = inv.total_cents - inv.credit_note_cents;
  const canIssueCredit = manage && !["draft", "void", "credited"].includes(inv.status) && creditableCents > 0;
  const downloadCreditNote = async (note: CreditNote) => {
    const blob = await apiBlob(`/credit-notes/${note.id}/pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead
        crumb={<Link to="/invoices">Invoices</Link>}
        title={inv.number ?? "Draft invoice"}
        sub={client?.name}
        actions={
          <>
            <InvoiceBadge inv={inv} />
            <button className="btn ghost" onClick={() => window.print()}>
              Print
            </button>
            {!draft && (
              <button
                className="btn ghost"
                disabled={email.isPending}
                onClick={() => email.mutate(undefined)}
              >
                {email.isPending ? "Queuing…" : "Email invoice"}
              </button>
            )}
            {!draft && (
              <button className="btn ghost" onClick={() => downloadPdf()}>
                PDF
              </button>
            )}
            {manage && draft && (
              <>
                <button
                  className="btn primary"
                  disabled={issue.isPending || !lines.length}
                  onClick={() => {
                    if (
                      confirm("Issue this invoice? It gets its number and can no longer be edited.")
                    )
                      issue.mutate(undefined);
                  }}
                >
                  Issue invoice
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (confirm("Discard this draft?"))
                      discard.mutateAsync(undefined).then(() => nav("/invoices"));
                  }}
                >
                  Discard
                </button>
              </>
            )}
            {manage && (inv.status === "sent" || inv.status === "partially_paid") && (
              <button className="btn primary" onClick={() => setPaying(true)}>
                Record payment
              </button>
            )}
            {canIssueCredit && (
              <button className="btn ghost" onClick={() => setCrediting(true)}>
                Issue credit note
              </button>
            )}
            {manage &&
              inv.status === "sent" &&
              inv.amount_paid_cents === 0 &&
              inv.credit_note_cents === 0 && (
                <button className="btn danger" onClick={() => setVoiding(true)}>
                  Void
                </button>
              )}
          </>
        }
      />
      <ErrorNote
        error={
          issue.error ??
          discard.error ??
          addTime.error ??
          addMs.error ??
          rmLine.error ??
          setMeta.error ??
          void_.error ??
          email.error ??
          issueCreditNote.error
        }
      />
      {inv.status === "void" && (
        <div className="error">
          Voided {fmtDate(inv.voided_at ?? null)}: {inv.void_reason}
        </div>
      )}
      {inv.status === "credited" && (
        <div className="notice">
          This invoice has been fully credited. Any cash returned to the client is recorded separately
          in the refund ledger.
        </div>
      )}
      <div className="cols">
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>Lines</h3>
              {manage && draft && (
                <button className="btn sm ghost" onClick={() => setLine(true)}>
                  Add line
                </button>
              )}
            </header>
            {!lines.length ? (
              <Empty title="No lines yet">
                Add a line, or bill approved time and milestones below.
              </Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit</th>
                    <th className="num">Amount</th>
                    {draft && manage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.description}</td>
                      <td className="num">{parseFloat(l.quantity)}</td>
                      <td className="num">{money(l.unit_cents, inv.currency)}</td>
                      <td className="num">{money(l.amount_cents, inv.currency)}</td>
                      {draft && manage && (
                        <td className="num">
                          <button className="btn sm danger" onClick={() => rmLine.mutate(l.id)}>
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="num muted">
                      Subtotal
                    </td>
                    <td className="num">{money(inv.subtotal_cents, inv.currency)}</td>
                    {draft && manage && <td />}
                  </tr>
                  <tr>
                    <td colSpan={3} className="num muted">
                      Tax ({bpsToPct(inv.tax_rate_bps)})
                    </td>
                    <td className="num">{money(inv.tax_cents, inv.currency)}</td>
                    {draft && manage && <td />}
                  </tr>
                  <tr className="total-row">
                    <td colSpan={3} className="num">
                      Total
                    </td>
                    <td className="num">{money(inv.total_cents, inv.currency)}</td>
                    {draft && manage && <td />}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          {manage && draft && inv.project_id && (
            <div className="panel">
              <header>
                <h3>Bill from the project</h3>
              </header>
              <div className="body" style={{ display: "grid", gap: 14 }}>
                <div>
                  <strong>Approved time</strong>
                  {!unbilled.data?.length ? (
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      No approved, unbilled time. Time must be approved on the My work page first.
                    </p>
                  ) : (
                    <>
                      <table>
                        <tbody>
                          {unbilled.data.map((r) => (
                            <tr key={r.entry_id}>
                              <td>{fmtDate(r.entry_date)}</td>
                              <td>{names(r.user_id)}</td>
                              <td className="num">{hours(r.minutes)}</td>
                              <td className="num">{money(r.amount_cents, inv.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button
                        className="btn sm primary"
                        disabled={addTime.isPending}
                        onClick={() => addTime.mutate(undefined)}
                      >
                        Add all ({money(unbilledTotal, inv.currency)})
                      </button>
                    </>
                  )}
                </div>
                <div>
                  <strong>Milestones</strong>
                  {!billableMs.length ? (
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      No billable milestones left.
                    </p>
                  ) : (
                    billableMs.map((m) => (
                      <div
                        className="row"
                        key={m.id}
                        style={{ justifyContent: "space-between", padding: "6px 0" }}
                      >
                        <span>
                          {m.name} · {money(m.amount_cents, inv.currency)}
                        </span>
                        <button className="btn sm ghost" onClick={() => addMs.mutate(m.id)}>
                          Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          {payments.length > 0 && (
            <div className="panel">
              <header>
                <h3>Payments</h3>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Method / reference</th>
                    <th className="num">Amount</th>
                    {manage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const paymentRefunds = refunds.filter((refund) => refund.payment_id === p.id);
                    const refundedCents = paymentRefunds.reduce((sum, refund) => sum + refund.amount_cents, 0);
                    const remainingCents = Math.max(p.amount_cents - refundedCents, 0);
                    return (
                      <tr key={p.id}>
                        <td>{fmtDate(p.paid_on)}</td>
                        <td>
                          {label(p.method)}
                          {p.reference && <div className="muted">{p.reference}</div>}
                          {refundedCents > 0 && (
                            <div className="muted">Refunded {money(refundedCents, inv.currency)}</div>
                          )}
                        </td>
                        <td className="num">{money(p.amount_cents, inv.currency)}</td>
                        {manage && (
                          <td className="num">
                            {remainingCents > 0 && inv.status !== "draft" && inv.status !== "void" && (
                              <button
                                className="btn sm ghost"
                                onClick={() => setRefundTarget({ payment: p, remainingCents })}
                              >
                                Record refund
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {refunds.length > 0 && (
            <div className="panel">
              <header>
                <h3>Refund history</h3>
                <span className="muted">{refunds.length}</span>
              </header>
              <div className="body">
                <p className="muted">
                  These entries record refunds already processed outside AgencyOS. They do not initiate
                  a transfer.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reason / reference</th>
                      <th>Method</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refunds.map((refund: PaymentRefund) => (
                      <tr key={refund.id}>
                        <td>{fmtDate(refund.refunded_on)}</td>
                        <td>
                          {refund.reason}
                          {refund.reference && <div className="muted">{refund.reference}</div>}
                        </td>
                        <td>{label(refund.method)}</td>
                        <td className="num">{money(refund.amount_cents, inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {creditNotes.length > 0 && (
            <div className="panel">
              <header>
                <h3>Credit notes</h3>
                <span className="muted">{creditNotes.length}</span>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Issued</th>
                    <th>Number / reason</th>
                    <th className="num">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.map((note) => (
                    <tr key={note.id}>
                      <td>{fmtDate(note.issued_on)}</td>
                      <td>
                        <strong>{note.number}</strong>
                        <div className="muted">{note.reason}</div>
                      </td>
                      <td className="num">{money(note.amount_cents, inv.currency)}</td>
                      <td className="num">
                        <button className="btn sm ghost" onClick={() => downloadCreditNote(note)}>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <CommentsPanel type="invoice" id={id} />
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>Summary</h3>
            </header>
            <div className="body">
              <dl className="facts">
                <dt>Issued</dt>
                <dd>{fmtDate(inv.issue_date)}</dd>
                <dt>Due</dt>
                <dd>
                  {draft && manage ? (
                    <input
                      type="date"
                      min={todayISO()}
                      defaultValue={inv.due_date ?? ""}
                      onBlur={(e) =>
                        e.target.value &&
                        e.target.value !== inv.due_date &&
                        setMeta.mutate({ due_date: e.target.value })
                      }
                    />
                  ) : (
                    fmtDate(inv.due_date)
                  )}
                </dd>
                <dt>Tax rate</dt>
                <dd>
                  {draft && manage ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={inv.tax_rate_bps / 100}
                      onBlur={(e) =>
                        setMeta.mutate({
                          tax_rate_bps: Math.round(parseFloat(e.target.value || "0") * 100),
                        })
                      }
                    />
                  ) : (
                    bpsToPct(inv.tax_rate_bps)
                  )}
                </dd>
                <dt>Paid</dt>
                <dd>{money(inv.amount_paid_cents, inv.currency)}</dd>
                <dt>Refunded</dt>
                <dd>{money(inv.amount_refunded_cents, inv.currency)}</dd>
                <dt>Credit notes</dt>
                <dd>{money(inv.credit_note_cents, inv.currency)}</dd>
                <dt>Balance due</dt>
                <dd>
                  <strong>{money(inv.balance_cents, inv.currency)}</strong>
                </dd>
                {inv.credit_balance_cents > 0 && (
                  <>
                    <dt>Client credit balance</dt>
                    <dd>
                      <strong>{money(inv.credit_balance_cents, inv.currency)}</strong>
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>
          <FilesPanel type="invoice" id={id} />
        </div>
      </div>
      {line && <LineForm id={id} onClose={() => setLine(false)} />}
      {paying && <PaymentForm inv={inv} onClose={() => setPaying(false)} />}
      {crediting && (
        <CreditNoteForm
          inv={inv}
          maxCents={creditableCents}
          onClose={() => setCrediting(false)}
        />
      )}
      {refundTarget && (
        <RefundForm
          inv={inv}
          payment={refundTarget.payment}
          remainingCents={refundTarget.remainingCents}
          onClose={() => setRefundTarget(null)}
        />
      )}
      {voiding && (
        <FormModal
          title="Void invoice"
          submitLabel="Void invoice"
          danger
          onClose={() => setVoiding(false)}
          onSubmit={() => void_.mutateAsync(undefined)}
        >
          <p style={{ marginTop: 0 }}>
            The number {inv.number} stays on record as void and any billed time becomes billable
            again.
          </p>
          <Field label="Reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              required
              autoFocus
            />
          </Field>
        </FormModal>
      )}
    </>
  );
}
