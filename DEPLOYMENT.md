# AgencyOS Frontend Deployment

## Backend-free deployment

The recruiter workspace is executed entirely in the visitor's browser. The frontend includes its own API-compatible runtime, local business rules, seeded workspace and IndexedDB persistence. It does not call the AgencyOS FastAPI service.

Deploy only this frontend repository. Do not deploy, start or configure the backend for the recruiter workspace.

## Production container

The frontend Docker image builds the Vite app and serves the static application with Nginx.

Build:

```bash
docker build -t agencyos-frontend .
```

Run:

```bash
docker run --rm -p 8080:80 agencyos-frontend
```

The Nginx configuration serves the single-page application with history fallback, provides a local `/healthz` response and adds browser security headers. There is no `/api` proxy and no backend upstream.

## Static hosting

The same built `dist/` directory can be deployed to a static host. Configure SPA history fallback to `index.html`. No API URL, database URL, server secret, or backend environment variable is required.

## Browser storage

Workspace records are persisted in IndexedDB in the visitor's browser profile. A localStorage fallback is used when IndexedDB is unavailable. Each visitor has their own independent workspace; data is not shared between browsers or devices.

## Verification

Before release verify:

- `npm ci`
- `npm run build`
- `npm run test:e2e`
- First-visit workspace initialization
- Role switching and client portal scoping
- Client, deal and proposal lifecycle
- Project creation from accepted proposals
- Time tracking and approvals
- Invoice issuance, payments and PDF generation
- File upload/download
- Reports, search and notifications
- Browser persistence and workspace reset
- Mobile and desktop layouts
