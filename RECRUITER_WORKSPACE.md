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

## Opening and exploring the workspace

Opening the deployed frontend initializes a local Owner session automatically, so the workspace opens without a sign-in step. Use the **View workspace as** selector in the top bar to inspect Owner, Admin, Account Manager, Project Manager, Team Member, Finance, and Client Portal permissions. Use **Reset workspace** to restore the original linked records after experimenting.

The browser stores this workspace in IndexedDB. It survives reloads and browser restarts in that same browser profile, but it is not shared with another recruiter's device or browser.

## Product behavior

The runtime mirrors the backend's important workflow rules: forward-only deal stages, one-way proposal states, proposal acceptance creating a project and milestones, project completion requiring finished tasks, one active timer per user, approved-time billing, invoice settlement, and permission-aware actions.

The seeded workspace exposes Owner, Admin, Account Manager, Project Manager, Team Member, Finance, and Client Portal personas. The role selector changes the active local identity while preserving each persona's permissions and portal scope.

## Boundaries

This is a single-browser workspace, not a shared multi-user database or a secure server-side authorization boundary. Email and invite delivery, outbound webhooks, payment collection/refunds, and background jobs are local workflow simulations. They do not send messages, call external webhook URLs, charge or refund money, or run jobs on a server. Payment entries update only the browser-local invoice ledger. No secrets are placed in browser code.

## Verification

The branch-specific GitHub Actions workflow runs the frontend production build and Playwright browser tests. It does not build, start, or deploy the FastAPI backend.
