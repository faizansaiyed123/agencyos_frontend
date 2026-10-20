import { STAGES, type Stage } from "./api/types";

export const money = (cents: number | null | undefined, currency = "USD") =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export const toCents = (v: string) => Math.round(parseFloat(v || "0") * 100);
export const fromCents = (c: number | null | undefined) => (c == null ? "" : String(c / 100));

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const STAGE_LABEL: Record<Stage, string> = {
  lead: "Lead", qualified: "Qualified", proposal_sent: "Proposal sent",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

// Mirror of crm/deal_states.py: forward one step, or lost from any open stage.
export const nextStages = (s: Stage): Stage[] => {
  const i = STAGES.indexOf(s);
  if (s === "won" || s === "lost") return [];
  return [STAGES[i + 1], "lost"];
};

export const lineTotal = (qty: string, unit: number) => Math.round(parseFloat(qty) * unit);

export const hours = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
export const bpsToPct = (bps: number) => `${bps / 100}%`;
export const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const todayISO = () => new Date().toISOString().slice(0, 10);
