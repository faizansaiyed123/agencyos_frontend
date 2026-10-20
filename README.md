# AgencyOS frontend

React + TypeScript + Vite 6 single-page app for the AgencyOS backend repository.
Every screen talks to the real API; there is no mock response layer.

## Run it

```bash
# 1. Backend: TWO processes (the worker sends invite emails and webhooks)
export AGENCYOS_COOKIE_SECURE=false          # local http only
cd backend
uvicorn app.main:app --port 8000
python -m app.worker                          # in a second terminal

# 2. Frontend
cd frontend && npm install && npm run dev     # http://localhost:5173
npm run build                                 # production bundle in dist/
npm run test:e2e                              # public-route browser smoke tests
```

Vite proxies `/api` to `localhost:8000`, so the browser sees one origin. That matters:
the refresh cookie is `SameSite=Strict`. In production serve `dist/` and the API from the
same host behind one reverse proxy.

## Screens

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
| Everywhere | Live notifications bell (Server-Sent Events), approvals inbox, search and keyword assistant |

Buttons are shown or hidden from the role table in `src/api/permissions.ts` (a copy of
`backend/app/core/permissions.py`). The server is always the authority.

## Notes
- The assistant is full-text keyword search plus report shortcuts. It never generates text,
  and the UI labels it that way.
- Money is integer cents end to end; `lib.ts` converts only at the input/display edge.
- `src/api/types.ts` was checked against live responses for all 36 interfaces.

## Layout
`src/api` client (token refresh, timeouts, safe retries, problem+json errors), types, hooks, permissions ·
`src/auth` session context · `src/components` shared UI (comments, files, bell, search) ·
`src/pages` screens.


## Release verification

Backend verification is run against the current backend `main` head.

Frontend CI verifies the production frontend build, Playwright smoke flow, and Docker image.
The companion backend compatibility workflow checks the backend repository's install, Ruff, tests,
and Docker image from the same release branch so the split repositories are verified together.
