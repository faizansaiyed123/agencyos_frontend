import { Link } from "react-router-dom";
import { useAttention, useClients, useDeals, useOverview, useProposals } from "../api/hooks";
import { routeFor } from "../components/TopBar";
import { can } from "../api/permissions";
import { useAuth } from "../auth/AuthContext";
import { Empty, PageHead, Spinner, StageBadge, StatusBadge } from "../components/ui";
import { money, STAGE_LABEL } from "../lib";
import type { Stage } from "../api/types";

const STAGE_COLOR: Record<string, string> = { lead: "#9aa5b4", qualified: "#6f7fe8", proposal_sent: "#4254e6", negotiation: "#2a3ce0", won: "#f4c430" };

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const showDeals = can(role, "deal:read"), showProps = can(role, "proposal:read"), showClients = can(role, "client:read");
  const deals = useDeals({}, showDeals); const proposals = useProposals({}, showProps); const clients = useClients(false, showClients);
  const ds = showDeals ? deals.data?.items ?? [] : [];
  const open = ds.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const won = ds.filter((d) => d.stage === "won");
  const sum = (xs: typeof ds) => xs.reduce((s, d) => s + (d.value_amount ?? 0), 0);
  const awaiting = showProps ? (proposals.data?.items ?? []).filter((p) => p.status === "sent") : [];
  const canReport = can(role, "report:read");
  const attention = useAttention(canReport); const overview = useOverview(canReport);
  const stages: Stage[] = ["lead", "qualified", "proposal_sent", "negotiation", "won"];
  const total = sum(ds.filter((d) => d.stage !== "lost")) || 1;
  const first = user?.full_name.split(" ")[0];

  if (showDeals && deals.isLoading) return <Spinner />;
  return (
    <>
      <PageHead title={`Hello, ${first}`} sub="Where your pipeline stands today." />
      {canReport && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <header><h3>Needs attention</h3><span className="muted">{attention.data?.length ?? 0} items</span></header>
          {attention.isLoading ? <Spinner /> : !attention.data?.length ? <Empty title="You're on top of things">No overdue invoices, late projects or stalled deals.</Empty> : (
            <table><tbody>{attention.data.slice(0, 8).map((a, i) => {
              const to = routeFor(a.entity_type, a.entity_id);
              return (<tr key={i} className={to ? "link" : ""}><td style={{ width: 90 }}><span className={`badge ${a.severity === "high" ? "brick" : a.severity === "medium" ? "sun" : ""}`}>{a.severity}</span></td>
                <td>{to ? <Link to={to}>{a.title}</Link> : a.title}</td></tr>);
            })}</tbody></table>
          )}
          {overview.data && overview.data.overdue_cents > 0 && <div className="body"><Link to="/invoices">{money(overview.data.overdue_cents)} overdue across invoices</Link></div>}
        </div>
      )}
      {showDeals ? (
        <>
          <div className="stats">
            <div className="stat"><div className="k">Open pipeline</div><div className="v">{money(sum(open))}</div></div>
            <div className="stat"><div className="k">Open deals</div><div className="v">{open.length}</div></div>
            <div className="stat"><div className="k">Won</div><div className="v">{money(sum(won))}</div></div>
            <div className="stat"><div className="k">Proposals awaiting reply</div><div className="v">{awaiting.length}</div></div>
          </div>
          <div className="cols">
            <div className="panel"><header><h3>Value by stage</h3><Link to="/deals">Open pipeline</Link></header><div className="body">
              <div className="bar" role="img" aria-label="Pipeline value by stage">
                {stages.map((s) => { const v = sum(ds.filter((d) => d.stage === s)); return v ? <i key={s} style={{ width: `${(v / total) * 100}%`, background: STAGE_COLOR[s] }} /> : null; })}
              </div>
              <div className="legend">{stages.map((s) => <span key={s} style={{ ["--c" as string]: STAGE_COLOR[s] }}>{STAGE_LABEL[s]} {money(sum(ds.filter((d) => d.stage === s)))}</span>)}</div>
            </div>
              {open.length > 0 && <table><tbody>{[...open].sort((a, b) => (b.value_amount ?? 0) - (a.value_amount ?? 0)).slice(0, 5).map((d) => (
                <tr key={d.id} className="link"><td><Link to={`/deals/${d.id}`}>{d.title}</Link></td><td><StageBadge stage={d.stage} /></td><td className="num">{money(d.value_amount, d.value_currency)}</td></tr>
              ))}</tbody></table>}
            </div>
            <div className="panel"><header><h3>Waiting on clients</h3></header>
              {!awaiting.length ? <Empty title="Nothing waiting">Sent proposals appear here until the client replies.</Empty> : (
                <table><tbody>{awaiting.map((p) => <tr key={p.id} className="link"><td><Link to={`/proposals/${p.id}`}>{p.title}</Link></td><td><StatusBadge status={p.status} /></td></tr>)}</tbody></table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="panel"><div className="body">
          <p style={{ marginTop: 0 }}>Your role doesn't include pipeline data.</p>
          {showClients && <Link className="btn primary" to="/clients">View clients ({clients.data?.total ?? "…"})</Link>}
        </div></div>
      )}
    </>
  );
}
