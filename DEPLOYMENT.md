# AgencyOS Frontend Deployment

## Production container

The frontend Docker image builds the Vite app and serves it with Nginx.

Build:

docker build -t agencyos-frontend .

Run:

docker run -p 8080:80 -e BACKEND_UPSTREAM=http://api.internal:8000 agencyos-frontend

The supplied Nginx configuration:

- serves the SPA with history fallback;
- proxies /api/ to BACKEND_UPSTREAM;
- proxies /healthz to the backend;
- adds baseline browser security headers.

## Same-origin recommendation

Put the frontend Nginx service on the public hostname and proxy /api/* to the backend service. The browser should then call https://app.example.com/api/v1/....

This is the simplest deployment shape for the existing httpOnly refresh-cookie design.

## Environment

The browser-side application does not need a public backend URL when Nginx is used as the API proxy. Do not put backend secrets into Vite environment variables or client bundles.

## Verification

Before release verify:

- npm ci
- npm run build
- sign-in, refresh, logout and MFA
- password recovery
- client/project/deal/proposal workflows
- invoice/payment workflow
- file upload/download
- reports
- responsive navigation on mobile and desktop
