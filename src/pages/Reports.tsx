import { useState } from "react";
import { Link } from "react-router-dom";
import { useOverview, usePipelineReport, useRevenue, useUtilization } from "../api/hooks";
import { Empty, PageHead, Spinner } from "../components/ui";
import { hours, label, money } from "../lib";

function RevenueChart({ data }: { data: { month: string; invoiced_cents: number; collected_cents: number }[] }) {
  const W = 720, H = 220, P = { l: 52, r: 8, t: 10, b: 28 };
  const max = Math.max(1, ...data.flatMap((d) => [d.invoiced_cents, d.collected_cents]));
  const bw = (W - P.l - P.r) / data.length;
  const y = (v: number) => H - P.b - ((H - P.t - P.b) * v) / max;
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Invoiced and collected by month">
      {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--mute)">{money(t).replace(/\.00$/, "")}</text></g>)}
      {data.map((d, i) => {
        const x = P.l + i * bw;
        return (
          <g key={d.month}>
            <rect x={x + bw * 0.12} y={y(d.invoiced_cents)} width={bw * 0.38} height={H - P.b - y(d.invoiced_cents)} fill="var(--blue)"><title>{`Invoiced ${money(d.invoiced_cents)}`}</title></rect>
            <rect x={x + bw * 0.52} y={y(d.collected_cents)} width={bw * 0.38} height={H - P.b - y(d.collected_cents)} fill="var(--sun)"><title>{`Collected ${money(d.collected_cents)}`}</title></rect>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--mute)">{new Date(d.month + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Reports() {
  const [months, setMonths] = useState(12);
  const o = useOverview(true); const rev = useRevenue(true, months); const pl = usePipelineReport(true); const ut = useUtilization(true);
  if (o.isLoading) return <Spinner />;
  const ov = o.data;
  return (
    <>
      <PageHead title="Reports" sub="Money, pipeline and team time, straight from your records." />
      {ov && (
        <div className="stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="stat"><div className="k">Outstanding</div><div className="v">{money(ov.outstanding_cents)}</div></div>
          <div className="stat"><div className="k">Overdue</div><div className="v" style={{ color: ov.overdue_cents ? "var(--brick)" : undefined }}>{money(ov.overdue_cents)}</div></div>
          <div className="stat"><div className="k">Collected this month</div><div className="v">{money(ov.collected_this_month_cents)}</div></div>
          <div className="stat"><div className="k">Unbilled approved time</div><div className="v">{money(ov.unbilled_time_cents)}</div></div>
          <div className="stat"><div className="k">Won this month</div><div className="v">{money(ov.won_this_month_cents)}</div></div>
          <div className="stat"><div className="k">Won year to date</div><div className="v">{money(ov.won_ytd_cents)}</div></div>
          <div className="stat"><div className="k">Active projects</div><div className="v">{ov.active_projects}</div></div>
          <div className="stat"><div className="k">Time awaiting approval</div><div className="v">{ov.pending_time_approvals}</div></div>
        </div>
      )}
      <div className="panel" style={{ marginBottom: 20 }}>
        <header><h3>Invoiced vs collected</h3>
          <div className="row"><span className="legend"><span style={{ ["--c" as string]: "var(--blue)" }}>Invoiced</span><span style={{ ["--c" as string]: "var(--sun)" }}>Collected</span></span>
            <select aria-label="Period" style={{ width: "auto" }} value={months} onChange={(e) => setMonths(+e.target.value)}>{[6, 12, 24].map((m) => <option key={m} value={m}>Last {m} months</option>)}</select></div>
        </header>
        <div className="body">{rev.isLoading ? <Spinner /> : rev.data ? <RevenueChart data={rev.data} /> : null}</div>
      </div>
      <div className="cols">
        <div className="panel"><header><h3>Team utilisation, last 30 days</h3></header>
          {ut.isLoading ? <Spinner /> : !ut.data?.some((r) => r.minutes > 0) ? <Empty title="No time logged in this period" /> : (
            <table><thead><tr><th>Person</th><th className="num">Logged</th><th className="num">Billable</th><th style={{ width: 140 }}>Billable share</th></tr></thead>
              <tbody>{ut.data.map((r) => (
                <tr key={r.user_id}><td>{r.full_name}</td><td className="num">{hours(r.minutes)}</td><td className="num">{hours(r.billable_minutes)}</td>
                  <td>{r.billable_pct === null ? <span className="muted">—</span> : <div className="row" style={{ gap: 6 }}><div className="progress" style={{ flex: 1 }}><i style={{ width: `${r.billable_pct}%` }} /></div><span>{Math.round(r.billable_pct)}%</span></div>}</td></tr>
              ))}</tbody></table>
          )}
        </div>
        <div className="panel"><header><h3>Pipeline</h3><Link to="/deals">Open board</Link></header>
          {pl.isLoading ? <Spinner /> : pl.data && (
            <div className="body">
              <table><tbody>{pl.data.stages.map((s) => <tr key={s.stage}><td>{label(s.stage)}</td><td className="num">{s.deals}</td><td className="num">{money(s.value_cents)}</td></tr>)}</tbody></table>
              <dl className="facts" style={{ marginTop: 12 }}>
                <dt>Win rate</dt><dd>{pl.data.win_rate === null ? "No closed deals yet" : `${Math.round(pl.data.win_rate * 100)}%`}</dd>
                <dt>Days to win</dt><dd>{pl.data.avg_days_to_win || "—"}</dd>
              </dl>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
