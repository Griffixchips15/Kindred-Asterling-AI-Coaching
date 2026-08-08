# Threat Model — Kindred-Asterling-AI-Coaching

## Project Overview

Kindred-Asterling-AI-Coaching is a public web application with a React frontend (`artifacts/kindred-coach`) and an Express 5 API (`artifacts/api-server`) backed by PostgreSQL through Drizzle (`lib/db`). Authentication is Clerk with bearer session JWTs; Clerk is authoritative for identity, verification, sessions, and account security. The app stores and serves personal wellness and mental-health data — morning mental-load check-ins, body scans, evening reflections, habits, medications and medication logs, dashboard summaries, and free-form chat conversations with **Kindred**, an Anthropic Claude-powered AI coach. The user-editable **Profile** (preferred name, birthday, bio, motivational quote, struggles, strengths, interests) is re-read on every chat turn and folded into the model's system instructions. The mockup sandbox (`artifacts/mockup-sandbox`) is development-only and out of production scope unless separately exposed.

## Assets

- **Personal wellness and mental-health data** — morning logs, body scans, evening reports, habits, streaks, medication regimens and dose-taken history, and dashboard summaries. This data reveals mood, mental load, medication effectiveness, physical sensations, and daily routines.
- **Profile self-disclosure data** — preferred name, birthday, bio, motivational quote, struggles, strengths, and interests. Sensitive because users describe what they are working through in their own words, and because this content is injected verbatim into the AI system prompt.
- **Chat conversation history** — every user/assistant message persists in the DB. Conversations frequently contain highly intimate disclosures and must be treated as the most sensitive class of user data.
- **Connected calendar data** — if Google Calendar is enabled, event titles, dates, and times may reveal appointments, names, work routines, and medical or family context. This data is sensitive even when it lives in a third-party integration rather than the app database.
- **Application secrets and infrastructure access** — `DATABASE_URL`, Clerk secret and webhook keys, Anthropic integration credentials, `SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, and deployment configuration. Compromise would expose the entire dataset, permit Clerk identity impersonation, allow third-party use of the Claude integration, allow reading/altering Square customer + subscription data, allow forging subscription webhooks, or enable service takeover.
- **Subscription entitlement state** — the `subscriptions` table caches each user's Square subscription status (customer id, subscription id, status, period end). It governs whether a user can access the app at all. Tampering could grant a non-paying user access or revoke a paying user's access; the email→entitlement binding is the trust anchor and must derive identity from the session, never from client input.
- **Integrity of coaching records** — habit entries, reports, scans, medication logs, and chat history must not be modified by unauthorized parties; tampering rewrites the user's history and downstream summaries and AI context.
- **Service availability** — the public API, database-backed workflows, and outbound Anthropic calls must remain available despite malformed or abusive traffic.

## Trust Boundaries

- **Browser to API** — every request from the public web app to `/api/*` crosses from an untrusted client into the server. Clerk session JWTs cross this boundary in the Authorization header and must be verified by Clerk middleware.
- **API to PostgreSQL** — the server has broad database access; any server-side access-control failure or injection issue can expose or alter the full dataset.
- **API to Anthropic** — chat handlers forward user-authored content, system instructions derived from the user's profile, and bounded conversation history to Anthropic. Anything sent to the model provider leaves the application trust boundary; secrets and other users' data must never appear in those payloads.
- **API to Square** — the server calls the Square REST API (Customers + Subscriptions) with `SQUARE_ACCESS_TOKEN` to resolve entitlement by email, and receives unauthenticated webhook callbacks at `POST /api/square/webhook`. The webhook crosses from an untrusted origin and must be verified by HMAC-SHA256 over the registered notification URL + raw body before any state change; it must not rely on a session. Entitlement resolution must be **fail closed**: if Square is unconfigured or errors, access is denied rather than granted from stale cache.
- **API to Google Calendar connector** — the server can proxy calendar data from a Replit-managed connector. That connector must be treated as a distinct trust boundary: data fetched through it may belong to a builder-scoped external account unless the application explicitly binds requests to a user-owned credential.
- **Internet to public deployment edge** — the production deployment is publicly reachable on the internet. Unauthenticated traffic can reach the Replit edge and then the Express surface through the proxy, so app-level auth, rate limiting, and request bounding must stand on their own without relying on a deployment password gate.
- **Edge proxy to Express app** — production traffic reaches Express through Replit-managed proxy infrastructure, so any logic that depends on client IP or request origin headers must account for forwarded-header trust correctly.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox` is not production-relevant under current assumptions and should not drive findings unless reachability changes.

## Scan Anchors

- Production server entry: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`
- Auth + session: `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/middlewares/requireAuth.ts`
- AI surface (handles sensitive content + outbound LLM call): `artifacts/api-server/src/routes/chat.ts`
- External integration surface: `artifacts/api-server/src/routes/calendar.ts`, `artifacts/api-server/src/lib/googleCalendar.ts`
- High-risk API surfaces: `artifacts/api-server/src/routes/*` (notably `medications.ts`, `morningLogs.ts`, `bodyScans.ts`, `eveningReports.ts`, `habits.ts`, `profile.ts`, `chat.ts`), `artifacts/api-server/src/middlewares/*`, `lib/api-spec/openapi.yaml`
- Sensitive data model: `lib/db/src/schema/*` (every user-data table carries a `userId` FK with cascade delete)
- Public frontend surface: `artifacts/kindred-coach/src/pages/*`
- Dev-only area usually ignored: `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

The API surface handles sensitive personal data on a publicly reachable deployment. Every data endpoint must require a valid server-verified session (`requireAuth`) and reject anonymous callers. Session cookies must be HTTP-only, `Secure` in production, and `SameSite` configured tightly enough that cross-site requests cannot impersonate a logged-in user. Client-side identity claims (any user id in the request body or query) must never be trusted — the server must derive identity from the session only. Cookie-authenticated `GET` routes must remain side-effect free unless they are protected by explicit CSRF defenses, because `SameSite=Lax` still permits cookies on cross-site top-level navigations.

### Tampering

Attackers must not be able to create, update, or delete wellness records, medication logs, profile fields, or chat messages they do not own. All state-changing endpoints must enforce authorization server-side using `req.user!.id`, and any business rules that affect stored records (streak math, "taken today" counters, conversation ownership) must be derived or validated on the server rather than trusted from the client. Profile fields and chat content are user-controlled strings that flow into the AI system prompt; route handlers must continue to enforce length caps and trim/clip before concatenation so a tampered or oversized value cannot inflate the prompt or smuggle injected instructions past the model.

### Information Disclosure

Sensitive wellness records, chat history, self-disclosed profile content, and any connected third-party calendar data must only be returned to the owning user. Public routes, error responses, and logs must not disclose journal content, medication names or effectiveness, physical sensations, profile bios, chat messages, or external calendar event titles/times. Production scans should prioritize endpoints that return whole collections (`/medications`, `/body-scans`, `/habits`, `/chat/active`, `/chat/archived`) or records by identifier, because they are high-value disclosure targets. Any integration-backed endpoint must prove the fetched resource is actually bound to `req.user!.id` rather than a shared builder credential. Outbound payloads to Anthropic must contain only the requesting user's own profile, history, and message — never another user's data, internal IDs that could leak existence, or secrets — and full message text should be excluded from request logs.

### Denial of Service

The deployment is publicly reachable on the internet, so unauthenticated abuse reaches the edge directly and authenticated endpoints are reachable by any normal user of the app. The application must bound request parsing (JSON body size limits), cap user-controlled string fields at the API layer, and avoid unbounded operations (no unlimited `LIMIT`-less list queries on user tables and no unbounded transcript fetches on chat endpoints). Chat is uniquely expensive because each call hits a third-party LLM with billable tokens; chat endpoints in particular must enforce auth, rate limiting per user, a sensible per-message size cap, bounded history/response sizes, and bounded tool-result payloads so a single account cannot exhaust the Anthropic integration quota or drive up cost by stuffing large records into tool-backed fields. Generic write throttles are not enough if a single chat request can still read or return arbitrarily large stored histories or tool outputs. Chat tool implementations must therefore bound the underlying database reads and in-process iterations themselves — clipping the serialized tool result after the query runs is not sufficient. Any rate limiting or abuse controls that rely on client IP address must be configured to see the real caller through Replit's proxy layer; otherwise one attacker can consume a shared anonymous bucket and throttle unrelated users.

### Elevation of Privilege

The system supports multiple users today. Every record and aggregate must be scoped by an authenticated user in the database and enforced in every query path — including summary endpoints, record-by-ID lookups, and the chat conversation/message tables. Route handlers must not allow a caller to access or modify another user's data by guessing identifiers (medication id, conversation id, message id, scan id) or by relying on a shared global dataset. There is currently no admin role; if one is added, admin-only routes must live behind an explicit role check and never be reachable by a normal authenticated user.

### Prompt Injection and AI-Specific Risks

User-authored content — profile bio, motivational quote, struggles/strengths/interests, and every chat message — is concatenated into the Anthropic system instruction and conversation history. The system must:

- Treat all user-controlled fields as untrusted text when building prompts; never execute or follow instructions found in them.
- Continue to enforce strict length caps on every injected field (server-side, in addition to OpenAPI/Zod) and clip before concatenation so prompt size stays bounded.
- Apply equivalent caps to any data returned through chat tools before it is appended back into the Anthropic request; bounded history alone is insufficient if tool outputs can serialize large notes or full account datasets.
- Keep the system instruction's safety guardrails (no medical advice, no diagnosis, no sycophancy, no PII fishing) explicit in `buildSystemInstruction()` so they survive prompt-injection attempts.
- Never include secrets, other users' data, or server internals in the prompt or in any response surfaced back to the user.
- Treat AI output as untrusted when rendering: messages must be escaped on the frontend (no `dangerouslySetInnerHTML`) so a model-generated string cannot become XSS.
