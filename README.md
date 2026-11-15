# AgencyOS frontend

React + TypeScript + Vite 6 single-page app with a browser-executed AgencyOS workspace.
The recruiter experience uses a local API-compatible runtime and IndexedDB persistence; it does not require a deployed or running backend. The backend repository is retained as the source-of-truth reference for business rules and API contracts.

## Run it

```bash
# Frontend only — no API server, PostgreSQL or worker is required
npm install && npm run dev                   # http://localhost:5173
npm run build                                 # production bundle in dist/
npm run test:e2e                              # public-route browser smoke tests
```

The frontend routes its existing API contract through the browser-local runtime. Production builds can be served as static files behind Nginx or any SPA-capable static host.

## Screens

> [!TIP]
> **Visual Verification Showcase**: Full side-by-side visual audits comparing every module before data injection (empty state) against populated states (along with mobile responsive screenshots) are available in [VISUAL_VERIFICATION.md](./VISUAL_VERIFICATION.md).

| Area | What you can do |
|---|---|
| Sign-in | Login, password recovery, create organisation, accept invite, two-factor step, silent token refresh |
| Client portal | Scoped project view, proposal review/acceptance, invoice status and PDF download |
| Overview | "Needs attention" feed (overdue invoices, late projects, expiring proposals, stalled deals), pipeline value by stage |
| Clients | List, detail, contacts, files, discussion |
| Pipeline | Drag-and-drop board, forward-only stage moves, lost reason, history |
| Proposals | Draft line items, send, accept (creates the project), reject, request approval |
| Projects | Task board (drag between columns), milestones, team and hourly rates, time, files, discussion, budget-used bar, lifecycle (start, hold, complete, cancel) |
| My work | Running timer, manual time entry, my time sheet, my tasks, approval queue for time |
| Invoices | Create draft, bill approved time and milestones, issue (gapless number), record payments (idempotent), void, print |
| Reports | Money KPIs, invoiced vs collected chart, team utilisation, pipeline and win rate |
| Team | Users, roles, invites |
| Settings | Webhooks (secret shown once, delivery log), feature flags with rollout, privacy export and erasure |
| Everywhere | Local notifications, approvals inbox, search and keyword assistant |

Navigation and actions follow the same role/permission matrix as the backend reference.
In this browser-only workspace the checks are part of the client runtime; they are
demonstration behavior, not a server-side security boundary.

## Notes
- The assistant is full-text keyword search plus report shortcuts. It never generates text,
  and the UI labels it that way.
- Workspace identities are preconfigured for exploration. This does not provide production
  authentication or protect secrets behind a server.
- Workspace changes are saved in the current browser profile and are not shared with other
  recruiters or devices. Use Reset workspace to restore the seeded records.
- Email, webhook delivery, payment processor actions and background workers are not invoked;
  their visible lifecycle is simulated locally.
- Money is integer cents end to end; `lib.ts` converts only at the input/display edge.
- `src/api/types.ts` was checked against live responses for all 36 interfaces.

## Layout
`src/api` client (token refresh, timeouts, safe retries, problem+json errors), types, hooks, permissions ·
`src/auth` session context · `src/components` shared UI (comments, files, bell, search) ·
`src/pages` screens.


## Recruiter workspace

The `recruiter-demo` branch contains a self-contained browser workspace. The frontend calls
an API-compatible local runtime, executes the product's business rules, and persists records
in IndexedDB. It does not require a backend URL, database, worker process, or deployed API.

The companion backend branch is intentionally unchanged and is used as the source-of-truth
reference for route contracts, data shapes, permissions and business workflows.

## Release verification

The recruiter-demo GitHub Actions workflow verifies the frontend production build,
Playwright browser journeys and frontend container build. It does not install, start,
test or deploy the backend.
