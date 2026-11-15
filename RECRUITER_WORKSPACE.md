# Recruiter workspace architecture

This branch adds an interactive, browser-executed AgencyOS workspace to the deployed frontend.

## Non-negotiable deployment boundary

The FastAPI backend is not deployed, started, or required by this experience. The companion backend repository is the behavioral reference only. The `recruiter-demo` branch in that repository is intentionally left without code changes.

## Request and persistence model

- Existing frontend calls under `/api/v1` are routed through `src/demo/runtime.ts`.
- The browser runtime returns HTTP-shaped responses, including successful JSON, empty 204 responses, file responses, and RFC 9457-style errors.
- The workspace state is stored in IndexedDB, with an in-memory/localStorage fallback when IndexedDB is unavailable.
- The initial workspace is seeded with linked clients, contacts, deals, proposals, projects, tasks, time entries, invoices, payments, notifications, and users.
- Mutations persist in the current browser profile. A workspace reset restores the original sample records.
- Domain events replace the backend Server-Sent Events stream for browser-local notifications.
- File upload, download, invoice PDF, and portal PDF paths are handled without an API server.

## Product behavior

The runtime mirrors the backend's important workflow rules: forward-only deal stages, one-way proposal states, proposal acceptance creating a project and milestones, project completion requiring finished tasks, one active timer per user, approved-time billing, invoice settlement, and permission-aware actions.

The seeded workspace exposes Owner, Admin, Account Manager, Project Manager, Team Member, Finance, and Client Portal personas. The role selector changes the active local identity while preserving each persona's permissions and portal scope.

## Boundaries

This is a single-browser workspace, not a shared multi-user database or a secure server-side authorization boundary. External email, webhook delivery, payment processing, and background jobs are local simulations and do not contact external systems. No secrets are placed in browser code.

## Verification

The branch-specific GitHub Actions workflow runs the frontend production build and Playwright browser tests. It does not build, start, or deploy the FastAPI backend.
