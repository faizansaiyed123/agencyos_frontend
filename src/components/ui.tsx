import { cloneElement, isValidElement, useEffect, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { STAGE_LABEL } from "../lib";
import type { ProposalStatus, Stage } from "../api/types";

export function Spinner({ label = "Loading…" }: { label?: string }) { return <div className="spin" role="status">{label}</div>; }

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Something went wrong.";
  return <div className="error" role="alert">{msg}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Modal wrapping a form; shows server errors and a pending state. */
export function FormModal({ title, submitLabel, onClose, onSubmit, children, danger }: {
  title: string; submitLabel: string; onClose: () => void; danger?: boolean;
  onSubmit: () => Promise<unknown>; children: ReactNode;
}) {
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await onSubmit(); onClose(); } catch (x) { setErr(x); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorNote error={err} />
        {children}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? "danger" : "primary"}`} disabled={busy}>{busy ? "Working…" : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

const STAGE_TONE: Record<Stage, string> = { lead: "", qualified: "blue", proposal_sent: "blue", negotiation: "blue", won: "sun", lost: "brick" };
export const StageBadge = ({ stage }: { stage: Stage }) => <span className={`badge ${STAGE_TONE[stage]}`}>{STAGE_LABEL[stage]}</span>;

const STATUS_TONE: Record<ProposalStatus, string> = { draft: "", sent: "blue", accepted: "moss", rejected: "brick", expired: "sun" };
export const StatusBadge = ({ status }: { status: ProposalStatus }) =>
  <span className={`badge ${STATUS_TONE[status]}`}>{status[0].toUpperCase() + status.slice(1)}</span>;

export function PageHead({ title, sub, crumb, actions }: { title: string; sub?: string; crumb?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>{crumb && <div className="crumb">{crumb}</div>}<h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
