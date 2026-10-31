import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import {
  useAction,
  useClients,
  useDeal,
  useDealHistory,
  useDeals,
  useProposals,
  useUsers,
} from "../api/hooks";
import { can } from "../api/permissions";
import { STAGES, type Deal, type Stage } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { CommentsPanel, FilesPanel, RequestApproval } from "../components/Collab";
import {
  Empty,
  ErrorNote,
  Field,
  FormModal,
  PageHead,
  Spinner,
  StageBadge,
  StatusBadge,
} from "../components/ui";
import { fmtDate, fromCents, money, nextStages, STAGE_LABEL, toCents } from "../lib";

function DealForm({
  initial,
  presetClient,
  onClose,
}: {
  initial?: Deal;
  presetClient?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const clients = useClients();
  const users = useUsers();
  const nav = useNavigate();
  const [f, setF] = useState({
    client_id: initial?.client_id ?? presetClient ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    value: fromCents(initial?.value_amount),
    currency: initial?.value_currency ?? "USD",
    owner_user_id: initial?.owner_user_id ?? user?.id ?? "",
    expected_close_date: initial?.expected_close_date ?? "",
  });
  const save = useAction(async () => {
    const common = {
      title: f.title,
      description: f.description || null,
      value_amount: f.value ? toCents(f.value) : null,
      value_currency: f.currency.toUpperCase(),
      owner_user_id: f.owner_user_id || null,
      expected_close_date: f.expected_close_date || null,
    };
    return initial
      ? api<Deal>(`/deals/${initial.id}`, { method: "PATCH", body: common })
      : api<Deal>("/deals", { body: { ...common, client_id: f.client_id } });
  }, ["deals", "deal"]);
  return (
    <FormModal
      title={initial ? "Edit deal" : "New deal"}
      submitLabel={initial ? "Save changes" : "Create deal"}
      onClose={onClose}
      onSubmit={async () => {
        const d = await save.mutateAsync(undefined);
        if (!initial) nav(`/deals/${(d as Deal).id}`);
      }}
    >
      {!initial && (
        <Field label="Client">
          <select
            value={f.client_id}
            onChange={(e) => setF({ ...f, client_id: e.target.value })}
            required
          >
            <option value="">Choose a client…</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Deal title">
        <input
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid2">
        <Field label="Value" hint="Required before the deal can be won.">
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.value}
            onChange={(e) => setF({ ...f, value: e.target.value })}
          />
        </Field>
        <Field label="Currency">
          <input
            value={f.currency}
            maxLength={3}
            minLength={3}
            onChange={(e) => setF({ ...f, currency: e.target.value })}
            required
          />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Owner">
          <select
            value={f.owner_user_id}
            onChange={(e) => setF({ ...f, owner_user_id: e.target.value })}
          >
            {users.data?.items
              .filter((u) => u.is_active)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Expected close">
          <input
            type="date"
            value={f.expected_close_date}
            onChange={(e) => setF({ ...f, expected_close_date: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </Field>
    </FormModal>
  );
}

function StageModal({ deal, to, onClose }: { deal: Deal; to: Stage; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const change = useAction(
    () =>
      api(`/deals/${deal.id}/stage`, {
        body: { to_stage: to, lost_reason: to === "lost" ? reason : null, note: note || null },
      }),
    ["deals", "deal", "deal-history"],
  );
  const winBlocked = to === "won" && !(deal.value_amount && deal.value_amount > 0);
  return (
    <FormModal
      title={`Move to ${STAGE_LABEL[to]}`}
      submitLabel={to === "lost" ? "Mark as lost" : `Move to ${STAGE_LABEL[to]}`}
      danger={to === "lost"}
      onClose={onClose}
      onSubmit={() => {
        if (winBlocked)
          throw new Error("Add a deal value above zero before marking this deal as won.");
        return change.mutateAsync(undefined);
      }}
    >
      <p style={{ marginTop: 0 }}>
        <strong>{deal.title}</strong> is currently <StageBadge stage={deal.stage} />. Deals only
        move forward, so this can't be undone.
      </p>
      {winBlocked && (
        <div className="notice">
          This deal has no value yet. Edit the deal and add one before winning it.
        </div>
      )}
      {to === "lost" && (
        <Field label="Why was it lost?">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        </Field>
      )}
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormModal>
  );
}

export function Pipeline() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const deals = useDeals();
  const clients = useClients();
  const [creating, setCreating] = useState(params.has("new"));
  const [pending, setPending] = useState<{ deal: Deal; to: Stage } | null>(null);
  const [dropOn, setDropOn] = useState<Stage | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const canManage = can(user?.role, "deal:manage");
  const clientName = (id: string) => clients.data?.items.find((c) => c.id === id)?.name ?? "";
  const items = deals.data?.items ?? [];
  const openTotal = items
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((s, d) => s + (d.value_amount ?? 0), 0);

  const drop = (to: Stage, id: string) => {
    setDropOn(null);
    setHint(null);
    const deal = items.find((d) => d.id === id);
    if (!deal || deal.stage === to) return;
    if (!nextStages(deal.stage).includes(to)) {
      setHint(
        deal.stage === "won" || deal.stage === "lost"
          ? "Closed deals can't be moved."
          : `From ${STAGE_LABEL[deal.stage]}, a deal can only move to ${nextStages(deal.stage)
              .map((s) => STAGE_LABEL[s])
              .join(" or ")}.`,
      );
      return;
    }
    setPending({ deal, to });
  };

  const lane = (stage: Stage) => {
    const col = items.filter((d) => d.stage === stage);
    const sum = col.reduce((s, d) => s + (d.value_amount ?? 0), 0);
    return (
      <section
        key={stage}
        className={`lane ${stage} ${dropOn === stage ? "drop" : ""}`}
        aria-label={STAGE_LABEL[stage]}
        onDragOver={(e) => {
          if (canManage) {
            e.preventDefault();
            setDropOn(stage);
          }
        }}
        onDragLeave={() => setDropOn((s) => (s === stage ? null : s))}
        onDrop={(e) => {
          e.preventDefault();
          if (canManage) drop(stage, e.dataTransfer.getData("text/plain"));
        }}
      >
        <header>
          <h3>
            {STAGE_LABEL[stage]}
            <small>
              {col.length} {col.length === 1 ? "deal" : "deals"}
            </small>
          </h3>
          <span className="sum">{money(sum)}</span>
        </header>
        {col.map((d) => (
          <article
            key={d.id}
            className="deal"
            draggable={canManage && !["won", "lost"].includes(d.stage)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
          >
            <h4>
              <Link to={`/deals/${d.id}`}>{d.title}</Link>
            </h4>
            <div className="meta">
              <span>{clientName(d.client_id)}</span>
              <span className="val">{money(d.value_amount, d.value_currency)}</span>
            </div>
          </article>
        ))}
      </section>
    );
  };

  return (
    <>
      <PageHead
        title="Pipeline"
        sub={`${money(openTotal)} in open deals`}
        actions={
          canManage && (
            <button className="btn primary" onClick={() => setCreating(true)}>
              New deal
            </button>
          )
        }
      />
      {canManage && (
        <p className="muted" style={{ marginTop: -10 }}>
          Drag a deal to the next stage to move it.
        </p>
      )}
      {hint && (
        <div className="notice" role="status">
          {hint}
        </div>
      )}
      <ErrorNote error={deals.error} />
      {deals.isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <div className="panel">
          <Empty title="No deals yet">
            {canManage ? "Create a deal from a client to start your pipeline." : "Nothing to show."}
          </Empty>
        </div>
      ) : (
        <>
          <div className="board">{STAGES.slice(0, 4).map(lane)}</div>
          <div className="board closed">{(["won", "lost"] as Stage[]).map(lane)}</div>
        </>
      )}
      {creating && (
        <DealForm
          presetClient={params.get("new") ?? undefined}
          onClose={() => {
            setCreating(false);
            setParams({});
          }}
        />
      )}
      {pending && (
        <StageModal deal={pending.deal} to={pending.to} onClose={() => setPending(null)} />
      )}
    </>
  );
}

export function DealDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const deal = useDeal(id);
  const history = useDealHistory(id);
  const proposals = useProposals({ deal_id: id });
  const clients = useClients(true);
  const users = useUsers();
  const [editing, setEditing] = useState(false);
  const [to, setTo] = useState<Stage | null>(null);
  if (deal.isLoading) return <Spinner />;
  if (deal.error || !deal.data)
    return (
      <>
        <ErrorNote error={deal.error} />
        <Link to="/deals">Back to pipeline</Link>
      </>
    );
  const d = deal.data;
  const closed = d.stage === "won" || d.stage === "lost";
  const canManage = can(user?.role, "deal:manage");
  const client = clients.data?.items.find((c) => c.id === d.client_id);
  const owner = users.data?.items.find((u) => u.id === d.owner_user_id);
  const who = (uid: string) => users.data?.items.find((u) => u.id === uid)?.full_name ?? "Someone";

  return (
    <>
      <PageHead
        crumb={<Link to="/deals">Pipeline</Link>}
        title={d.title}
        sub={client?.name}
        actions={
          <>
            <StageBadge stage={d.stage} />
            <RequestApproval type="deal" id={d.id} title={d.title} />
            {canManage && !closed && (
              <>
                <button className="btn ghost" onClick={() => setEditing(true)}>
                  Edit
                </button>
                {nextStages(d.stage)
                  .filter((s) => s !== "lost")
                  .map((s) => (
                    <button key={s} className="btn primary" onClick={() => setTo(s)}>
                      Move to {STAGE_LABEL[s]}
                    </button>
                  ))}
                <button className="btn danger" onClick={() => setTo("lost")}>
                  Mark lost
                </button>
              </>
            )}
          </>
        }
      />
      <div className="cols">
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>Details</h3>
            </header>
            <div className="body">
              <dl className="facts">
                <dt>Client</dt>
                <dd>{client ? <Link to={`/clients/${client.id}`}>{client.name}</Link> : "—"}</dd>
                <dt>Value</dt>
                <dd>{money(d.value_amount, d.value_currency)}</dd>
                <dt>Owner</dt>
                <dd>{owner?.full_name ?? "—"}</dd>
                <dt>Expected close</dt>
                <dd>{fmtDate(d.expected_close_date)}</dd>
                {d.closed_at && (
                  <>
                    <dt>Closed</dt>
                    <dd>{fmtDate(d.closed_at)}</dd>
                  </>
                )}
                {d.lost_reason && (
                  <>
                    <dt>Lost because</dt>
                    <dd>{d.lost_reason}</dd>
                  </>
                )}
                {d.description && (
                  <>
                    <dt>Description</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{d.description}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>
          <div className="panel">
            <header>
              <h3>Proposals</h3>
              {can(user?.role, "proposal:manage") && d.stage !== "lost" && (
                <Link className="btn sm ghost" to={`/proposals?new=${d.id}`}>
                  New proposal
                </Link>
              )}
            </header>
            {!proposals.data?.items.length ? (
              <Empty title="No proposals for this deal" />
            ) : (
              <table>
                <tbody>
                  {proposals.data.items.map((p) => (
                    <tr key={p.id} className="link">
                      <td>
                        <Link to={`/proposals/${p.id}`}>{p.title}</Link>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="muted num">{fmtDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>Stage history</h3>
            </header>
            <div className="body">
              {history.isLoading ? (
                <Spinner />
              ) : (
                <ol className="timeline">
                  {[...(history.data ?? [])].reverse().map((h, i) => (
                    <li key={i}>
                      <strong>
                        {h.from_stage
                          ? `${STAGE_LABEL[h.from_stage]} → ${STAGE_LABEL[h.to_stage]}`
                          : `Created as ${STAGE_LABEL[h.to_stage]}`}
                      </strong>
                      <small>
                        {who(h.changed_by)}, {fmtDate(h.created_at)}
                      </small>
                      {h.note && <div>{h.note}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <FilesPanel type="deal" id={d.id} />
          <CommentsPanel type="deal" id={d.id} />
        </div>
      </div>
      {editing && <DealForm initial={d} onClose={() => setEditing(false)} />}
      {to && <StageModal deal={d} to={to} onClose={() => setTo(null)} />}
    </>
  );
}
