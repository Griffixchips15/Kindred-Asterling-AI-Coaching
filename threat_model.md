# Threat Model

## Project Overview

Kindred Coach is a public web application with a React frontend (`artifacts/kindred-coach`) and an Express API (`artifacts/api-server`) backed by PostgreSQL through Drizzle (`lib/db`). It stores and serves personal wellness and health-journaling data including morning mental-load check-ins, body scans, evening reflections, habits, and dashboard summaries. The mockup sandbox (`artifacts/mockup-sandbox`) is development-only and is out of production scope unless separately exposed.

## Assets

- **Personal wellness and health-journaling data** -- morning logs, body scans, evening reports, habits, streaks, and dashboard summaries. This data is sensitive because it reveals mood, mental load, medication effectiveness, physical sensations, and daily routines.
- **Application secrets and infrastructure access** -- `DATABASE_URL`, any future auth keys, and deployment configuration. Compromise would expose the entire dataset or permit service takeover.
- **Integrity of coaching records** -- habit entries, reports, and scans must not be modified by unauthorized parties because tampering changes the user’s history and downstream summaries.
- **Service availability** -- the public API and database-backed workflows must remain available despite malformed or abusive traffic.

## Trust Boundaries

- **Browser to API** -- every request from the public web app to `/api/*` crosses from an untrusted client into the server.
- **API to PostgreSQL** -- the server has broad database access; any server-side access-control failure or injection issue can expose or alter the full dataset.
- **Public internet to deployed application** -- the deployment is public, so unauthenticated endpoints are internet-reachable by default.
- **Edge proxy to Express app** -- production traffic reaches Express through Replit-managed proxy infrastructure, so any logic that depends on client IP or request origin headers must account for forwarded-header trust correctly.
- **Production vs dev-only artifacts** -- `artifacts/mockup-sandbox` is not production-relevant under current assumptions and should not drive findings unless reachability changes.

## Scan Anchors

- Production server entry: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`
- High-risk API surfaces: `artifacts/api-server/src/routes/*`, `artifacts/api-server/src/middlewares/*`, `lib/api-spec/openapi.yaml`
- Sensitive data model: `lib/db/src/schema/*`
- Public frontend surface: `artifacts/kindred-coach/src/pages/*`
- Dev-only area usually ignored: `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

This project currently exposes a public API surface that handles sensitive personal data. Any endpoint that reads or mutates user data must require a valid server-verified identity. Client-side assumptions about who the user is are not sufficient; the API must authenticate every protected request and reject anonymous callers.

### Tampering

Attackers must not be able to create, update, or delete wellness records they do not own. All state-changing endpoints must enforce authorization server-side, and any business rules that affect stored records must be derived or validated on the server rather than trusted from the client.

### Information Disclosure

Sensitive wellness records must only be returned to the owning user. Public routes, error responses, and logs must not disclose journal content, medication effectiveness, physical sensations, or other private reflections. Production scans should prioritize endpoints that return whole collections or records by identifier because they are high-value disclosure targets.

### Denial of Service

Because the deployment is public, endpoints that accept unauthenticated traffic are exposed to scraping and abuse. The application must bound request parsing and expensive operations, and sensitive public-facing endpoints should not allow trivial bulk extraction or repeated write abuse. Any rate limiting or abuse controls that rely on client IP address must be configured to see the real caller through Replit's proxy layer; otherwise one attacker can potentially consume a shared anonymous bucket and throttle unrelated users.

### Elevation of Privilege

If the system later supports multiple users, every record and aggregate must be scoped by an authenticated user or tenant key in the database and enforced in every query path. Route handlers, summary endpoints, and record-by-ID lookups must not allow a caller to access or modify another user’s data by guessing identifiers or by relying on a shared global dataset.
