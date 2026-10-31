import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import {
  useAction,
  useMyTasks,
  useProjects,
  useTimeEntries,
  useTimer,
  useUsers,
} from "../api/hooks";
import { can } from "../api/permissions";
import type { TaskStatus } from "../api/types";
import { TASK_STATUSES } from "../api/types";
import { useNames } from "../api/useNames";
import { useAuth } from "../auth/AuthContext";
import { Empty, ErrorNote, Field, FormModal, PageHead, Spinner } from "../components/ui";
import { fmtDate, hours, label, money, todayISO } from "../lib";

function useElapsed(startedAt: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return "0:00:00";
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function ManualEntry({ onClose }: { onClose: () => void }) {
  const projects = useProjects({ status: "active" });
  const [f, setF] = useState({
    project_id: "",
    entry_date: todayISO(),
    hours: "1",
    description: "",
    billable: true,
  });
  const save = useAction(
    () =>
      api("/time/entries", {
        body: {
          project_id: f.project_id,
          entry_date: f.entry_date,
          minutes: Math.round(parseFloat(f.hours) * 60),
          description: f.description || null,
          billable: f.billable,
        },
      }),
    ["time"],
  );
  return (
    <FormModal
      title="Log time"
      submitLabel="Log time"
      onClose={onClose}
      onSubmit={() => save.mutateAsync(undefined)}
    >
      <Field label="Project">
        <select
          value={f.project_id}
          onChange={(e) => setF({ ...f, project_id: e.target.value })}
          required
        >
          <option value="">Choose…</option>
          {projects.data?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid2">
        <Field label="Date">
          <input
            type="date"
            max={todayISO()}
            value={f.entry_date}
            onChange={(e) => setF({ ...f, entry_date: e.target.value })}
            required
          />
        </Field>
        <Field label="Hours">
          <input
            type="number"
            min="0.02"
            max="24"
            step="0.25"
            value={f.hours}
            onChange={(e) => setF({ ...f, hours: e.target.value })}
            required
          />
        </Field>
      </div>
      <Field label="What did you do?">
        <input
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </Field>
      <label className="row" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          style={{ width: "auto" }}
          checked={f.billable}
          onChange={(e) => setF({ ...f, billable: e.target.checked })}
        />{" "}
        Billable
      </label>
    </FormModal>
  );
}

export default function Work() {
  const { user } = useAuth();
  const names = useNames();
  const timer = useTimer();
  const projects = useProjects({ status: "active" });
  const tasks = useMyTasks();
  const [from, setFrom] = useState(""); // week filter placeholder: show everything recent
  const entries = useTimeEntries(from ? { date_from: from } : {});
  const approver = can(user?.role, "time:approve");
  const queue = useTimeEntries({ status: "draft" }, approver);
  const users = useUsers(approver);
  const [project, setProject] = useState("");
  const [desc, setDesc] = useState("");
  const [manual, setManual] = useState(false);
  const elapsed = useElapsed(timer.data?.started_at);
  const start = useAction(
    () => api("/time/timer/start", { body: { project_id: project, description: desc || null } }),
    ["timer", "time"],
  );
  const stop = useAction(() => api("/time/timer/stop", { method: "POST" }), ["timer", "time"]);
  const del = useAction((id: string) => api(`/time/entries/${id}`, { method: "DELETE" }), ["time"]);
  const approve = useAction(
    (ids: string[]) => api("/time/approve", { body: { entry_ids: ids } }),
    ["time", "overview"],
  );
  const move = useAction(
    ({ id, status }: { id: string; status: TaskStatus }) =>
      api(`/tasks/${id}`, { method: "PATCH", body: { status } }),
    ["tasks"],
  );
  const pname = (id: string) => projects.data?.items.find((p) => p.id === id)?.name ?? "Project";
  const mine = entries.data?.filter((e) => e.user_id === user?.id) ?? [];
  const weekMinutes = mine
    .filter((e) => new Date(e.entry_date) >= new Date(Date.now() - 7 * 864e5))
    .reduce((s, e) => s + e.minutes, 0);
  const toApprove = (queue.data ?? []).filter((e) => e.user_id !== user?.id && e.ended_at);
  void users;

  return (
    <>
      <PageHead
        title="My work"
        sub="Your timer, your tasks and your time sheet."
        actions={
          <button className="btn ghost" onClick={() => setManual(true)}>
            Log time manually
          </button>
        }
      />
      <ErrorNote error={start.error ?? stop.error ?? del.error ?? approve.error ?? move.error} />
      {can(user?.role, "time:log") && (
        <div className="timerbar" role="group" aria-label="Timer">
          {timer.data ? (
            <>
              <span className="clock" aria-live="off">
                {elapsed}
              </span>
              <span>
                on <strong>{pname(timer.data.project_id)}</strong>
                {timer.data.description ? ` · ${timer.data.description}` : ""}
              </span>
              <button
                className="btn primary"
                style={{ marginLeft: "auto" }}
                disabled={stop.isPending}
                onClick={() => stop.mutate(undefined)}
              >
                Stop
              </button>
            </>
          ) : (
            <>
              <span className="clock">0:00:00</span>
              <select
                aria-label="Project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">Choose a project…</option>
                {projects.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="What are you working on?"
                placeholder="What are you working on?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <button
                className="btn primary"
                style={{ marginLeft: "auto" }}
                disabled={!project || start.isPending}
                onClick={() => start.mutate(undefined)}
              >
                Start timer
              </button>
            </>
          )}
        </div>
      )}
      <div className="cols">
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>My time</h3>
              <span className="muted">{hours(weekMinutes)} in the last 7 days</span>
            </header>
            {entries.isLoading ? (
              <Spinner />
            ) : !mine.length ? (
              <Empty title="No time logged">Start the timer or log time manually.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th className="num">Time</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {mine.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtDate(e.entry_date)}</td>
                      <td>
                        {pname(e.project_id)}
                        <div className="muted">{e.description}</div>
                      </td>
                      <td className="num">{e.ended_at ? hours(e.minutes) : "running"}</td>
                      <td>
                        <span
                          className={`badge ${e.status === "approved" ? "moss" : e.status === "invoiced" ? "blue" : ""}`}
                        >
                          {label(e.status)}
                        </span>
                        {!e.billable && (
                          <>
                            {" "}
                            <span className="badge">Non-billable</span>
                          </>
                        )}
                      </td>
                      <td className="num">
                        {e.status === "draft" && e.ended_at && (
                          <button className="btn sm danger" onClick={() => del.mutate(e.id)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="body">
              <label className="muted">
                Show since{" "}
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ width: "auto", marginLeft: 6 }}
                />
              </label>
            </div>
          </div>
          {approver && (
            <div className="panel">
              <header>
                <h3>Time waiting for approval</h3>
                {toApprove.length > 0 && (
                  <button
                    className="btn sm primary"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(toApprove.map((e) => e.id))}
                  >
                    Approve all ({toApprove.length})
                  </button>
                )}
              </header>
              {!toApprove.length ? (
                <Empty title="Nothing to approve" />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Who</th>
                      <th>Project</th>
                      <th>Date</th>
                      <th className="num">Time</th>
                      <th className="num">Value</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {toApprove.map((e) => (
                      <tr key={e.id}>
                        <td>{names(e.user_id)}</td>
                        <td>{pname(e.project_id)}</td>
                        <td>{fmtDate(e.entry_date)}</td>
                        <td className="num">{hours(e.minutes)}</td>
                        <td className="num">
                          {e.billable
                            ? money(Math.floor((e.minutes * (e.rate_cents ?? 0) + 30) / 60))
                            : "—"}
                        </td>
                        <td className="num">
                          <button className="btn sm ghost" onClick={() => approve.mutate([e.id])}>
                            Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        <div className="panel">
          <header>
            <h3>My tasks</h3>
          </header>
          {tasks.isLoading ? (
            <Spinner />
          ) : !tasks.data?.filter((t) => t.status !== "done").length ? (
            <Empty title="No open tasks" />
          ) : (
            <ul className="thread" style={{ padding: 16 }}>
              {tasks.data
                .filter((t) => t.status !== "done")
                .map((t) => (
                  <li key={t.id}>
                    <strong>{t.title}</strong>
                    <div className="row">
                      <Link to={`/projects/${t.project_id}`}>{pname(t.project_id)}</Link>
                      {t.due_date && <span className="muted">due {fmtDate(t.due_date)}</span>}
                    </div>
                    <select
                      aria-label={`Status of ${t.title}`}
                      value={t.status}
                      style={{ width: "auto", marginTop: 4 }}
                      onChange={(e) =>
                        move.mutate({ id: t.id, status: e.target.value as TaskStatus })
                      }
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
      {manual && <ManualEntry onClose={() => setManual(false)} />}
    </>
  );
}
