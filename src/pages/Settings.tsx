import { useState } from "react";
import { api } from "../api/client";
import { useAction, useDeliveries, useFlags, useUsers, useWebhookEvents, useWebhooks } from "../api/hooks";
import { can } from "../api/permissions";
import { useAuth } from "../auth/AuthContext";
import { Empty, ErrorNote, Field, Modal, PageHead, Spinner } from "../components/ui";
import { ago, label } from "../lib";

function AddWebhook({ events, onClose }: { events: string[]; onClose: () => void }) {
  const [url, setUrl] = useState(""); const [picked, setPicked] = useState<string[]>(["*"]);
  const [secret, setSecret] = useState<string | null>(null); const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const create = useAction(() => api<{ secret: string }>("/webhooks", { body: { url, events: picked } }), ["webhooks"]);
  if (secret) {
    return (
      <Modal title="Signing secret" onClose={onClose}>
        <div className="notice">Copy this secret now. It is shown only once. Use it to verify the <code>X-AgencyOS-Signature</code> header on each delivery.</div>
        <code className="secret">{secret}</code>
        <div className="actions"><button className="btn primary" onClick={onClose}>Done</button></div>
      </Modal>
    );
  }
  return (
    <Modal title="Add webhook endpoint" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { setSecret(((await create.mutateAsync(undefined)) as { secret: string }).secret); } catch (x) { setErr(x); } finally { setBusy(false); } }}>
        <ErrorNote error={err} />
        <Field label="HTTPS URL"><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required autoFocus placeholder="https://example.com/hooks/agencyos" /></Field>
        <Field label="Events">
          <label className="row"><input type="checkbox" style={{ width: "auto" }} checked={picked.includes("*")} onChange={(e) => setPicked(e.target.checked ? ["*"] : [])} /> All events</label>
          {!picked.includes("*") && <div style={{ display: "grid", gap: 4, marginTop: 6 }}>{events.map((ev) => <label className="row" key={ev}><input type="checkbox" style={{ width: "auto" }} checked={picked.includes(ev)} onChange={(e) => setPicked(e.target.checked ? [...picked, ev] : picked.filter((x) => x !== ev))} /> {ev}</label>)}</div>}
        </Field>
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || picked.length === 0}>{busy ? "Creating…" : "Create endpoint"}</button></div>
      </form>
    </Modal>
  );
}

function Webhooks() {
  const q = useWebhooks(); const events = useWebhookEvents();
  const [adding, setAdding] = useState(false); const [selected, setSelected] = useState<string | null>(null);
  const deliveries = useDeliveries(selected);
  const toggle = useAction(({ id, is_active }: { id: string; is_active: boolean }) => api(`/webhooks/${id}`, { method: "PATCH", body: { is_active } }), ["webhooks"]);
  const del = useAction((id: string) => api(`/webhooks/${id}`, { method: "DELETE" }), ["webhooks"]);
  return (
    <div className="panel">
      <header><h3>Webhooks</h3><button className="btn sm ghost" onClick={() => setAdding(true)}>Add endpoint</button></header>
      <ErrorNote error={toggle.error ?? del.error} />
      {q.isLoading ? <Spinner /> : !q.data?.length ? <Empty title="No webhooks">Send signed events (invoice paid, task completed…) to your own systems.</Empty> : (
        <table><thead><tr><th>URL</th><th>Events</th><th /></tr></thead>
          <tbody>{q.data.map((w) => (
            <tr key={w.id}><td style={{ wordBreak: "break-all" }}>{w.url} {!w.is_active && <span className="badge">Paused</span>}</td><td className="muted">{w.events.includes("*") ? "All events" : w.events.join(", ")}</td>
              <td className="num"><button className="btn sm ghost" onClick={() => setSelected(selected === w.id ? null : w.id)}>Deliveries</button>{" "}
                <button className="btn sm ghost" onClick={() => toggle.mutate({ id: w.id, is_active: !w.is_active })}>{w.is_active ? "Pause" : "Resume"}</button>{" "}
                <button className="btn sm danger" onClick={() => { if (confirm("Delete this endpoint?")) del.mutate(w.id); }}>Delete</button></td></tr>
          ))}</tbody></table>
      )}
      {selected && (
        <div className="body">
          <strong>Recent deliveries</strong>
          {!deliveries.data?.length ? <p className="muted">None yet.</p> : (
            <table><tbody>{deliveries.data.map((d) => <tr key={d.id}><td>{d.event_type}</td><td><span className={`badge ${d.status === "success" ? "moss" : d.status === "failed" ? "brick" : "sun"}`}>{label(d.status)}</span></td><td className="muted">{d.response_status ?? ""} {d.last_error ?? ""}</td><td className="muted num">{d.attempts}× · {ago(d.created_at)}</td></tr>)}</tbody></table>
          )}
        </div>
      )}
      {adding && <AddWebhook events={events.data ?? []} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Flags() {
  const q = useFlags();
  const set = useAction(({ key, enabled, rollout_percent }: { key: string; enabled: boolean; rollout_percent: number }) => api(`/flags/${key}`, { method: "PUT", body: { enabled, rollout_percent } }), ["flags", "flags-me"]);
  return (
    <div className="panel">
      <header><h3>Feature flags</h3></header>
      <ErrorNote error={set.error} />
      {q.isLoading ? <Spinner /> : (
        <table><thead><tr><th>Feature</th><th>On</th><th style={{ width: 200 }}>Rollout to</th></tr></thead>
          <tbody>{q.data?.map((f) => (
            <tr key={f.key}><td><strong>{f.description}</strong><div className="muted">{f.key}</div></td>
              <td><input type="checkbox" aria-label={`Enable ${f.description}`} style={{ width: "auto" }} checked={f.enabled} onChange={(e) => set.mutate({ key: f.key, enabled: e.target.checked, rollout_percent: f.rollout_percent })} /></td>
              <td><div className="row"><input type="range" aria-label={`Rollout for ${f.description}`} min={0} max={100} step={10} value={f.rollout_percent} disabled={!f.enabled} onChange={(e) => set.mutate({ key: f.key, enabled: f.enabled, rollout_percent: +e.target.value })} style={{ padding: 0 }} /><span>{f.rollout_percent}%</span></div></td></tr>
          ))}</tbody></table>
      )}
    </div>
  );
}

function Privacy() {
  const { user } = useAuth(); const users = useUsers(); const [err, setErr] = useState<unknown>(null); const [msg, setMsg] = useState<string | null>(null);
  const download = async (id: string, who: string, self: boolean) => {
    setErr(null);
    try {
      const data = await api(self ? "/privacy/export/me" : `/privacy/export/${id}`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `agencyos-data-${who}.json`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setErr(e); }
  };
  const erase = useAction((id: string) => api<{ retained: string[] }>(`/privacy/erase/${id}`, { method: "POST" }), ["users"]);
  const admin = can(user?.role, "privacy:manage");
  return (
    <div className="panel">
      <header><h3>Privacy (GDPR)</h3></header>
      <div className="body">
        <p style={{ marginTop: 0 }}>Download everything we hold about you as a JSON file.</p>
        <button className="btn ghost" onClick={() => user && download(user.id, "me", true)}>Export my data</button>
      </div>
      <ErrorNote error={err ?? erase.error} />
      {msg && <div className="body"><div className="notice">{msg}</div></div>}
      {admin && (
        <table><thead><tr><th>Person</th><th /></tr></thead>
          <tbody>{users.data?.items.map((u) => (
            <tr key={u.id}><td>{u.full_name}<div className="muted">{u.email}</div></td>
              <td className="num"><button className="btn sm ghost" onClick={() => download(u.id, u.full_name.replace(/\W+/g, "-"), false)}>Export</button>{" "}
                {!u.email.endsWith("@erased.invalid") && u.id !== user?.id && <button className="btn sm danger" onClick={async () => {
                  if (!confirm(`Erase ${u.full_name}? Their name, email, login and comment text are removed permanently. Invoices, time entries and audit records are kept for accounting.`)) return;
                  const r = await erase.mutateAsync(u.id).catch(() => null); if (r) setMsg(`${u.full_name} was erased. Kept for legal reasons: ${r.retained.join("; ")}.`);
                }}>Erase</button>}</td></tr>
          ))}</tbody></table>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  return (
    <>
      <PageHead title="Settings" sub="Integrations, feature switches and data privacy." />
      <div style={{ display: "grid", gap: 20, maxWidth: 900 }}>
        {can(user?.role, "webhook:manage") && <Webhooks />}
        {can(user?.role, "flag:manage") && <Flags />}
        <Privacy />
      </div>
    </>
  );
}
