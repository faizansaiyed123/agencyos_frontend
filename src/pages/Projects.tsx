import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import {
  useAction,
  useClients,
  useProject,
  useProjectHealth,
  useProjects,
  useTasks,
  useTimeEntries,
  useUsers,
} from "../api/hooks";
import { can } from "../api/permissions";
import { useNames } from "../api/useNames";
import {
  PROJECT_STATUSES,
  TASK_STATUSES,
  type Milestone,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskStatus,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { CommentsPanel, FilesPanel, RequestApproval } from "../components/Collab";
import { Empty, ErrorNote, Field, FormModal, PageHead, Spinner } from "../components/ui";
import { fmtDate, fromCents, hours, label, money, toCents } from "../lib";

const TONE: Record<ProjectStatus, string> = {
  planning: "",
  active: "blue",
  on_hold: "sun",
  completed: "moss",
  cancelled: "brick",
};
export const ProjectBadge = ({ status }: { status: ProjectStatus }) => (
  <span className={`badge ${TONE[status]}`}>{label(status)}</span>
);

function NewProject({ onClose }: { onClose: () => void }) {
  const clients = useClients();
  const users = useUsers();
  const { user } = useAuth();
  const [f, setF] = useState({
    client_id: "",
    name: "",
    budget: "",
    due_date: "",
    manager: user?.id ?? "",
  });
  const create = useAction(
    () =>
      api<Project>("/projects", {
        body: {
          client_id: f.client_id,
          name: f.name,
          budget_amount: f.budget ? toCents(f.budget) : null,
          due_date: f.due_date || null,
          manager_user_id: f.manager || null,
        },
      }),
    ["projects"],
  );
  return (
    <FormModal
      title="New project"
      submitLabel="Create project"
      onClose={onClose}
      onSubmit={() => create.mutateAsync(undefined)}
    >
      <Field label="Client">
        <select
          value={f.client_id}
          onChange={(e) => setF({ ...f, client_id: e.target.value })}
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
      <Field label="Project name">
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid2">
        <Field label="Budget">
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.budget}
            onChange={(e) => setF({ ...f, budget: e.target.value })}
          />
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={f.due_date}
            onChange={(e) => setF({ ...f, due_date: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Project manager">
        <select value={f.manager} onChange={(e) => setF({ ...f, manager: e.target.value })}>
          {users.data?.items
            .filter((u) => u.is_active)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
        </select>
      </Field>
    </FormModal>
  );
}

export function Projects() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const q = useProjects(status ? { status } : {});
  const clients = useClients(true);
  const cname = (id: string) => clients.data?.items.find((c) => c.id === id)?.name ?? "—";
  return (
    <>
      <PageHead
        title="Projects"
        sub="Delivery work, created automatically when a proposal is accepted."
        actions={
          <>
            <select
              aria-label="Filter by status"
              style={{ width: "auto" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            {can(user?.role, "project:manage") && (
              <button className="btn primary" onClick={() => setCreating(true)}>
                New project
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
          <Empty title="No projects yet">Accept a proposal and its project appears here.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Status</th>
                <th>Due</th>
                <th className="num">Budget</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((p) => (
                <tr key={p.id} className="link">
                  <td>
                    <Link to={`/projects/${p.id}`}>
                      <strong>{p.name}</strong>
                    </Link>
                  </td>
                  <td>{cname(p.client_id)}</td>
                  <td>
                    <ProjectBadge status={p.status} />
                  </td>
                  <td className="muted">{fmtDate(p.due_date)}</td>
                  <td className="num">{money(p.budget_amount, p.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <NewProject onClose={() => setCreating(false)} />}
    </>
  );
}

function TaskForm({
  projectId,
  members,
  milestones,
  initial,
  onClose,
}: {
  projectId: string;
  members: string[];
  milestones: Milestone[];
  initial?: Task;
  onClose: () => void;
}) {
  const names = useNames();
  const [f, setF] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    assignee: initial?.assignee_user_id ?? "",
    priority: initial?.priority ?? "medium",
    due: initial?.due_date ?? "",
    est: initial?.estimate_minutes ? String(initial.estimate_minutes / 60) : "",
    milestone: initial?.milestone_id ?? "",
  });
  const save = useAction(() => {
    const common = {
      title: f.title,
      description: f.description || null,
      priority: f.priority,
      due_date: f.due || null,
      estimate_minutes: f.est ? Math.round(parseFloat(f.est) * 60) : null,
      milestone_id: f.milestone || null,
    };
    return initial
      ? api(`/tasks/${initial.id}`, {
          method: "PATCH",
          body: {
            ...common,
            assignee_user_id: f.assignee || null,
            unassign: !f.assignee && !!initial.assignee_user_id,
          },
        })
      : api(`/projects/${projectId}/tasks`, {
          body: { ...common, assignee_user_id: f.assignee || null },
        });
  }, ["tasks", "project"]);
  return (
    <FormModal
      title={initial ? "Edit task" : "New task"}
      submitLabel={initial ? "Save changes" : "Add task"}
      onClose={onClose}
      onSubmit={() => save.mutateAsync(undefined)}
    >
      <Field label="Title">
        <input
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid2">
        <Field label="Assignee">
          <select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
            <option value="">Unassigned</option>
            {members.map((id) => (
              <option key={id} value={id}>
                {names(id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={f.priority}
            onChange={(e) => setF({ ...f, priority: e.target.value as Task["priority"] })}
          >
            {["low", "medium", "high"].map((p) => (
              <option key={p} value={p}>
                {label(p)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Due">
          <input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </Field>
        <Field label="Estimate (hours)">
          <input
            type="number"
            min="0"
            step="0.25"
            value={f.est}
            onChange={(e) => setF({ ...f, est: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Milestone">
        <select value={f.milestone} onChange={(e) => setF({ ...f, milestone: e.target.value })}>
          <option value="">None</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </Field>
    </FormModal>
  );
}

function TaskBoard({
  project,
  members,
  milestones,
  closed,
}: {
  project: string;
  members: string[];
  milestones: Milestone[];
  closed: boolean;
}) {
  const { user } = useAuth();
  const names = useNames();
  const q = useTasks(project);
  const [form, setForm] = useState<Task | "new" | null>(null);
  const [dropOn, setDropOn] = useState<TaskStatus | null>(null);
  const manage = can(user?.role, "project:manage");
  const move = useAction(
    ({ id, status }: { id: string; status: TaskStatus }) =>
      api(`/tasks/${id}`, { method: "PATCH", body: { status } }),
    ["tasks", "project"],
  );
  const del = useAction(
    (id: string) => api(`/tasks/${id}`, { method: "DELETE" }),
    ["tasks", "project"],
  );
  const mayMove = (t: Task) => !closed && (manage || t.assignee_user_id === user?.id);
  return (
    <div className="panel">
      <header>
        <h3>Tasks</h3>
        {manage && !closed && (
          <button className="btn sm ghost" onClick={() => setForm("new")}>
            Add task
          </button>
        )}
      </header>
      <div className="body">
        <ErrorNote error={move.error ?? del.error} />
        {q.isLoading ? (
          <Spinner />
        ) : (
          <div className="taskboard">
            {TASK_STATUSES.map((s) => {
              const col = q.data?.filter((t) => t.status === s) ?? [];
              return (
                <section
                  key={s}
                  className={`tcol ${dropOn === s ? "drop" : ""}`}
                  aria-label={label(s)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropOn(s);
                  }}
                  onDragLeave={() => setDropOn(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropOn(null);
                    const t = q.data?.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                    if (t && t.status !== s && mayMove(t)) move.mutate({ id: t.id, status: s });
                  }}
                >
                  <h4>
                    {label(s)} <span className="muted">{col.length}</span>
                  </h4>
                  {col.map((t) => (
                    <article
                      key={t.id}
                      className={`task ${t.priority}`}
                      draggable={mayMove(t)}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    >
                      <strong>{t.title}</strong>
                      <div className="meta">
                        <span>{names(t.assignee_user_id)}</span>
                        <span>{t.due_date ? fmtDate(t.due_date) : ""}</span>
                      </div>
                      {(manage || t.assignee_user_id === user?.id) && !closed && (
                        <div className="row" style={{ marginTop: 6 }}>
                          <select
                            aria-label={`Status of ${t.title}`}
                            value={t.status}
                            style={{ padding: "2px 4px", fontSize: 12 }}
                            onChange={(e) =>
                              move.mutate({ id: t.id, status: e.target.value as TaskStatus })
                            }
                          >
                            {TASK_STATUSES.map((x) => (
                              <option key={x} value={x}>
                                {label(x)}
                              </option>
                            ))}
                          </select>
                          {manage && (
                            <>
                              <button className="link-btn" onClick={() => setForm(t)}>
                                Edit
                              </button>
                              <button
                                className="link-btn"
                                onClick={() => {
                                  if (confirm("Delete this task?")) del.mutate(t.id);
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
      {form && (
        <TaskForm
          projectId={project}
          members={members}
          milestones={milestones}
          initial={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}

function MilestoneForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: string;
  initial?: Milestone;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    due: initial?.due_date ?? "",
    amount: fromCents(initial?.amount_cents),
  });
  const save = useAction(() => {
    const body = {
      name: f.name,
      due_date: f.due || null,
      amount_cents: f.amount ? toCents(f.amount) : null,
    };
    return initial
      ? api(`/milestones/${initial.id}`, { method: "PATCH", body })
      : api(`/projects/${projectId}/milestones`, { body });
  }, ["project"]);
  return (
    <FormModal
      title={initial ? "Edit milestone" : "New milestone"}
      submitLabel="Save"
      onClose={onClose}
      onSubmit={() => save.mutateAsync(undefined)}
    >
      <Field label="Name">
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid2">
        <Field label="Due">
          <input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </Field>
        <Field label="Billable amount" hint="Optional. Lets you invoice this milestone.">
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
          />
        </Field>
      </div>
    </FormModal>
  );
}

export function ProjectDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const names = useNames();
  const q = useProject(id);
  const clients = useClients(true);
  const users = useUsers();
  const manage = can(user?.role, "project:manage");
  const canReport = can(user?.role, "report:read");
  const health = useProjectHealth(id, canReport);
  const time = useTimeEntries({ project_id: id });
  const [tab, setTab] = useState<"tasks" | "milestones" | "team" | "time" | "files">("tasks");
  const [ms, setMs] = useState<Milestone | "new" | null>(null);
  const [uid, setUid] = useState("");
  const [rate, setRate] = useState("");
  const status = useAction(
    (s: string) => api(`/projects/${id}/status`, { body: { status: s } }),
    ["project", "projects"],
  );
  const doneMs = useAction(
    ({ mid, done }: { mid: string; done: boolean }) =>
      api(`/milestones/${mid}`, { method: "PATCH", body: { done } }),
    ["project"],
  );
  const delMs = useAction(
    (mid: string) => api(`/milestones/${mid}`, { method: "DELETE" }),
    ["project"],
  );
  const addMember = useAction(
    () =>
      api(`/projects/${id}/members`, {
        body: { user_id: uid, hourly_rate_cents: rate ? toCents(rate) : null },
      }),
    ["project"],
  );
  const rmMember = useAction(
    (u: string) => api(`/projects/${id}/members/${u}`, { method: "DELETE" }),
    ["project"],
  );
  const setRateFor = useAction(
    ({ u, r }: { u: string; r: string }) =>
      api(`/projects/${id}/members/${u}`, {
        method: "PATCH",
        body: { hourly_rate_cents: r ? toCents(r) : null },
      }),
    ["project"],
  );

  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data)
    return (
      <>
        <ErrorNote error={q.error} />
        <Link to="/projects">Back to projects</Link>
      </>
    );
  const { project: p, members, milestones, task_counts } = q.data;
  const closed = p.status === "completed" || p.status === "cancelled";
  const totalTasks = Object.values(task_counts).reduce((a, b) => a + b, 0);
  const done = task_counts.done ?? 0;
  const client = clients.data?.items.find((c) => c.id === p.client_id);
  const next: Record<string, string[]> = {
    planning: ["active", "cancelled"],
    active: ["on_hold", "completed", "cancelled"],
    on_hold: ["active", "cancelled"],
    completed: [],
    cancelled: [],
  };
  const h = health.data;

  return (
    <>
      <PageHead
        crumb={<Link to="/projects">Projects</Link>}
        title={p.name}
        sub={[client?.name, `Manager: ${names(p.manager_user_id)}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <ProjectBadge status={p.status} />
            <RequestApproval type="project" id={id} title={p.name} />
            {manage &&
              next[p.status].map((s) => (
                <button
                  key={s}
                  className={`btn ${s === "cancelled" ? "danger" : s === "completed" || s === "active" ? "primary" : "ghost"}`}
                  disabled={status.isPending}
                  onClick={() => {
                    if (s !== "cancelled" || confirm("Cancel this project? It can't be reopened."))
                      status.mutate(s);
                  }}
                >
                  {s === "active"
                    ? p.status === "on_hold"
                      ? "Resume"
                      : "Start"
                    : label(s === "on_hold" ? "put on hold" : s)}
                </button>
              ))}
          </>
        }
      />
      <ErrorNote
        error={
          status.error ??
          doneMs.error ??
          addMember.error ??
          rmMember.error ??
          delMs.error ??
          setRateFor.error
        }
      />
      <div className="stats">
        <div className="stat">
          <div className="k">Budget</div>
          <div className="v">{money(p.budget_amount, p.currency)}</div>
        </div>
        <div className="stat">
          <div className="k">Tasks done</div>
          <div className="v">
            {done}/{totalTasks}
          </div>
        </div>
        <div className="stat">
          <div className="k">Due</div>
          <div className="v" style={{ fontSize: 20 }}>
            {fmtDate(p.due_date)}
          </div>
        </div>
        <div className="stat">
          <div className="k">Hours logged</div>
          <div className="v">{h ? hours(h.minutes_logged) : "—"}</div>
        </div>
      </div>
      {h && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="body">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Budget used (time value)</strong>
              <span>
                {money(h.time_value_cents, p.currency)} of {money(h.budget_cents, p.currency)} ·
                invoiced {money(h.invoiced_cents, p.currency)} · paid{" "}
                {money(h.paid_cents, p.currency)}
              </span>
            </div>
            <div
              className={`progress ${h.budget_used_pct !== null && h.budget_used_pct > 100 ? "over" : ""}`}
              style={{ marginTop: 8 }}
              role="progressbar"
              aria-valuenow={h.budget_used_pct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${Math.min(100, h.budget_used_pct ?? 0)}%` }} />
            </div>
          </div>
        </div>
      )}
      <div className="tabs" role="tablist">
        {(["tasks", "milestones", "team", "time", "files"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "on" : ""}
            onClick={() => setTab(t)}
          >
            {label(t)}
          </button>
        ))}
      </div>
      {tab === "tasks" && (
        <TaskBoard
          project={id}
          members={members.map((m) => m.user_id)}
          milestones={milestones}
          closed={closed}
        />
      )}
      {tab === "milestones" && (
        <div className="panel">
          <header>
            <h3>Milestones</h3>
            {manage && !closed && (
              <button className="btn sm ghost" onClick={() => setMs("new")}>
                Add milestone
              </button>
            )}
          </header>
          {!milestones.length ? (
            <Empty title="No milestones" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Due</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  {manage && <th />}
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className="muted">{fmtDate(m.due_date)}</td>
                    <td className="num">{money(m.amount_cents, p.currency)}</td>
                    <td>
                      <span className={`badge ${m.status === "done" ? "moss" : ""}`}>
                        {label(m.status)}
                      </span>
                    </td>
                    {manage && (
                      <td className="num">
                        {!closed && (
                          <>
                            <button
                              className="btn sm ghost"
                              onClick={() =>
                                doneMs.mutate({ mid: m.id, done: m.status !== "done" })
                              }
                            >
                              {m.status === "done" ? "Reopen" : "Mark done"}
                            </button>{" "}
                            <button className="btn sm ghost" onClick={() => setMs(m)}>
                              Edit
                            </button>{" "}
                            <button
                              className="btn sm danger"
                              onClick={() => {
                                if (confirm("Delete milestone?")) delMs.mutate(m.id);
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "team" && (
        <div className="panel">
          <header>
            <h3>Team and billing rates</h3>
          </header>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th className="num">Hourly rate</th>
                {manage && <th />}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    {names(m.user_id)}{" "}
                    {m.user_id === p.manager_user_id && <span className="badge blue">Manager</span>}
                  </td>
                  <td className="num">
                    {manage ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Rate for ${names(m.user_id)}`}
                        style={{ width: 110, textAlign: "right" }}
                        defaultValue={fromCents(m.hourly_rate_cents)}
                        onBlur={(e) => {
                          if (e.target.value !== fromCents(m.hourly_rate_cents))
                            setRateFor.mutate({ u: m.user_id, r: e.target.value });
                        }}
                      />
                    ) : (
                      money(m.hourly_rate_cents, p.currency)
                    )}
                  </td>
                  {manage && (
                    <td className="num">
                      {m.user_id !== p.manager_user_id && !closed && (
                        <button
                          className="btn sm danger"
                          onClick={() => rmMember.mutate(m.user_id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {manage && !closed && (
            <div className="body row">
              <select
                aria-label="Add team member"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="">Add a person…</option>
                {users.data?.items
                  .filter(
                    (u) =>
                      u.is_active &&
                      u.role !== "client" &&
                      !members.some((m) => m.user_id === u.id),
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Hourly rate"
                aria-label="Hourly rate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                style={{ width: 130 }}
              />
              <button
                className="btn primary sm"
                disabled={!uid || addMember.isPending}
                onClick={async () => {
                  await addMember.mutateAsync(undefined);
                  setUid("");
                  setRate("");
                }}
              >
                Add
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                Rates are copied onto time entries when they are logged, so changing one never
                alters past work.
              </span>
            </div>
          )}
        </div>
      )}
      {tab === "time" && (
        <div className="panel">
          <header>
            <h3>Time on this project</h3>
            <Link to="/work">Log time</Link>
          </header>
          {!time.data?.length ? (
            <Empty title="No time logged yet" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Who</th>
                  <th className="num">Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {time.data.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.entry_date)}</td>
                    <td>{names(e.user_id)}</td>
                    <td className="num">{hours(e.minutes)}</td>
                    <td>
                      <span
                        className={`badge ${e.status === "approved" ? "moss" : e.status === "invoiced" ? "blue" : ""}`}
                      >
                        {label(e.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "files" && <FilesPanel type="project" id={id} />}
      <div style={{ marginTop: 20 }}>
        <CommentsPanel type="project" id={id} />
      </div>
      {ms && (
        <MilestoneForm
          projectId={id}
          initial={ms === "new" ? undefined : ms}
          onClose={() => setMs(null)}
        />
      )}
    </>
  );
}
