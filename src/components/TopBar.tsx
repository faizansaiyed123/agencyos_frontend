import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { subscribeDemoEvents } from "../demo/events";
import { resetWorkspace } from "../demo/runtime";
import { useAuth } from "../auth/AuthContext";
import { useAction, useApprovals, useNotifications, useSearch, useUnread } from "../api/hooks";
import { useMyFlags } from "../api/hooks";
import type { AskResult, EntityType } from "../api/types";
import { useNames } from "../api/useNames";
import { ago, label } from "../lib";
import { ErrorNote } from "./ui";

const ROUTE: Record<string, (id: string) => string> = {
  client: (id) => `/clients/${id}`,
  deal: (id) => `/deals/${id}`,
  proposal: (id) => `/proposals/${id}`,
  project: (id) => `/projects/${id}`,
  invoice: (id) => `/invoices/${id}`,
  task: () => "/work",
};
/** ts_headline wraps matches in <b>; the text between comes from user content. Escape
 * everything, then restore only the exact <b> / </b> markers, so nothing else can be HTML. */
const safeSnippet = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)b&gt;/g, "<$1b>");

export const routeFor = (type: string | null, id: string | null) =>
  type && id && ROUTE[type] ? ROUTE[type](id) : null;

/** Local domain events replace the server-sent event stream in the browser workspace. */
function useLiveNotifications() {
  const qc = useQueryClient();
  useEffect(() => {
    return subscribeDemoEvents((event) => {
      if (event.type === "notification" || event.type === "workspace.reset") {
        for (const key of ["notifications", "unread", "tasks", "approvals", "overview", "attention"])
          qc.invalidateQueries({ queryKey: [key] });
      }
    });
  }, [qc]);
}

function Bell() {
  useLiveNotifications();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useUnread();
  const list = useNotifications();
  const inbox = useApprovals(true);
  const name = useNames();
  const read = useAction(
    (ids: string[] | null) => api("/notifications/read", { body: { ids } }),
    ["notifications", "unread"],
  );
  const decide = useAction(
    ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      api(`/approvals/${id}/decide`, { body: { approve, note } }),
    ["approvals", "notifications"],
  );
  const pending = inbox.data?.filter((a) => a.status === "pending") ?? [];
  const count = (unread.data?.unread ?? 0) + pending.length;
  return (
    <div className="bell">
      <button
        className="icon-btn"
        aria-label={`Notifications, ${count} unread`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 && <span className="dot">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="dropdown" role="dialog" aria-label="Notifications">
          <ErrorNote error={decide.error} />
          {pending.length > 0 && <div className="dd-section">Needs your decision</div>}
          {pending.map((a) => (
            <div className="dd-item" key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <div className="muted">
                  from {name(a.requested_by)} · {ago(a.created_at)}
                </div>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button
                  className="btn sm primary"
                  onClick={() => decide.mutate({ id: a.id, approve: true })}
                >
                  Approve
                </button>
                <button
                  className="btn sm danger"
                  onClick={() => {
                    const note = prompt("Why are you rejecting this?");
                    if (note?.trim()) decide.mutate({ id: a.id, approve: false, note });
                  }}
                >
                  Reject
                </button>
                {routeFor(a.entity_type, a.entity_id) && (
                  <button
                    className="link-btn"
                    onClick={() => {
                      nav(routeFor(a.entity_type, a.entity_id)!);
                      setOpen(false);
                    }}
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="dd-section">
            Activity{" "}
            {(unread.data?.unread ?? 0) > 0 && (
              <button className="link-btn" onClick={() => read.mutate(null)}>
                Mark all read
              </button>
            )}
          </div>
          {!list.data?.length ? (
            <div className="dd-item muted">You're all caught up.</div>
          ) : (
            list.data.map((n) => (
              <button
                key={n.id}
                className={`dd-item btn-reset ${n.is_read ? "" : "unread"}`}
                onClick={() => {
                  if (!n.is_read) read.mutate([n.id]);
                  const to = routeFor(n.entity_type, n.entity_id);
                  if (to) {
                    nav(to);
                    setOpen(false);
                  }
                }}
              >
                <span>{n.title}</span>
                <small className="muted">
                  {label(n.kind)} · {ago(n.created_at)}
                </small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const nav = useNavigate();
  const flags = useMyFlags();
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState<unknown>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const res = useSearch(debounced);
  const ask = async () => {
    setAsking(true);
    setAskErr(null);
    try {
      setAnswer(await api<AskResult>("/assistant/ask", { body: { question: q } }));
    } catch (e) {
      setAskErr(e);
    } finally {
      setAsking(false);
    }
  };
  const go = (type: string, id: string) => {
    const to = routeFor(type, id);
    if (to) {
      nav(to);
      setOpen(false);
      setQ("");
      setAnswer(null);
    }
  };
  return (
    <div className="searchbox" ref={box}>
      <input
        aria-label="Search"
        placeholder="Search or ask a question…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setAnswer(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && flags.data?.assistant && q.trim().length > 1) ask();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && q.trim().length >= 2 && (
        <div className="dropdown wide" role="listbox">
          {answer && (
            <div className="dd-item answer">
              <div className="muted" style={{ fontSize: 12 }}>
                Assistant (keyword search, not generated text)
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{answer.answer}</div>
              {answer.sources.map((s) => (
                <button key={s.type + s.id} className="link-btn" onClick={() => go(s.type, s.id)}>
                  {label(s.type)}: {s.title}
                </button>
              ))}
            </div>
          )}
          <ErrorNote error={askErr} />
          {flags.data?.assistant && !answer && (
            <button className="dd-item btn-reset" onClick={ask} disabled={asking}>
              {asking ? "Thinking…" : `Ask: “${q}” ↵`}
            </button>
          )}
          {res.isLoading ? (
            <div className="dd-item muted">Searching…</div>
          ) : !res.data?.length ? (
            <div className="dd-item muted">No matches.</div>
          ) : (
            res.data.map((h) => (
              <button
                key={h.type + h.id}
                className="dd-item btn-reset"
                onClick={() => go(h.type as EntityType, h.id)}
              >
                <span>
                  <span className="badge">{label(h.type)}</span> <strong>{h.title}</strong>
                </span>
                <small
                  className="muted"
                  dangerouslySetInnerHTML={{ __html: safeSnippet(h.snippet) }}
                />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function WorkspaceControls() {
  const { user, login } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const accounts = [
    { email: "owner@agencyos.local", label: "Owner" },
    { email: "admin@agencyos.local", label: "Admin" },
    { email: "alex@agencyos.local", label: "Account manager" },
    { email: "sarah@agencyos.local", label: "Project manager" },
    { email: "jamie@agencyos.local", label: "Team member" },
    { email: "taylor@agencyos.local", label: "Finance" },
    { email: "client@agencyos.local", label: "Client portal" },
  ];
  const switchAccount = async (email: string) => {
    if (!email || email === user?.email) return;
    setBusy(true);
    try {
      await login(email, "workspace-access");
      qc.clear();
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!window.confirm("Reset this browser workspace to its original sample records? Your local changes will be cleared.")) return;
    setBusy(true);
    try {
      await resetWorkspace();
      await login("owner@agencyos.local", "workspace-access");
      qc.clear();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="workspace-controls">
      <label className="sr-only" htmlFor="workspace-role">View workspace as</label>
      <select
        id="workspace-role"
        aria-label="View workspace as"
        value={accounts.some((account) => account.email === user?.email) ? user?.email : "owner@agencyos.local"}
        disabled={busy}
        onChange={(event) => void switchAccount(event.target.value)}
      >
        {accounts.map((account) => (
          <option key={account.email} value={account.email}>{account.label}</option>
        ))}
      </select>
      <button type="button" className="btn sm ghost" disabled={busy} onClick={() => void reset()}>
        {busy ? "Working…" : "Reset workspace"}
      </button>
    </div>
  );
}

export default function TopBar() {
  return (
    <div className="topbar">
      <SearchBox />
      <WorkspaceControls />
      <Bell />
      <span className="sr-only">
        <Link to="/">Home</Link>
      </span>
    </div>
  );
}
