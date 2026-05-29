# Kindred-Asterling-AI-Coaching

A personal wellness companion web app. Users journal their day (morning check-ins, body scans, evening reflections), track habits and medications, and chat with **Kindred**, a Claude-powered AI coach that knows their profile and history.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/kindred-coach run dev` — run the web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only — production needs a separate push after deploy)
- Required env (already configured): `DATABASE_URL`, `SESSION_SECRET`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (the last two are managed by the Replit Anthropic integration — do not edit). `GEMINI_API_KEY` is no longer used by chat.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 with Pino logging, OIDC (Replit Auth) sessions
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + Tailwind + React Query + Wouter routing
- AI: Anthropic Claude via `@workspace/integrations-anthropic-ai` (Replit-managed integration — no user API key, billed to Replit credits)
- Validation: Zod (`zod/v4`) + `drizzle-zod`
- API codegen: Orval (React Query hooks + Zod schemas from OpenAPI)
- Integrations: Google Calendar (installed, available for future use)

## Where things live

- **DB schema (source of truth):** `lib/db/src/schema/*` — every user-data table has a `userId` FK that cascades on delete
- **API contract (source of truth):** `lib/api-spec/openapi.yaml` — never hand-edit generated client/zod files
- **API routes:** `artifacts/api-server/src/routes/*` — all data routes are scoped to `req.user!.id` behind `requireAuth`
- **Auth:** `artifacts/api-server/src/routes/auth.ts` — Replit OIDC + session cookies
- **Frontend pages:** `artifacts/kindred-coach/src/pages/*` (dashboard, morning, scans, evening, habits, medications, chat, profile, archive)
- **Layout & nav:** `artifacts/kindred-coach/src/components/layout/app-layout.tsx` — collapsible sidebar (state persisted in localStorage)
- **AI system prompt:** `artifacts/api-server/src/routes/chat.ts` → `buildSystemInstruction()`
- **Theme:** `artifacts/kindred-coach/src/hooks/use-theme.tsx` + `src/index.css` (light/dark + accent palettes)

## Architecture decisions

- **Contract-first API.** OpenAPI → Orval generates both the React Query client and Zod request/response validators. Always edit `openapi.yaml` and regen — never hand-edit generated files.
- **Per-user data isolation.** Every data table has a `userId` FK and every route filters by `req.user!.id`. The threat model treats journal content as sensitive.
- **Chat re-reads profile on every turn.** `buildSystemInstruction()` pulls fresh user fields (preferred name, struggles, strengths, interests, bio, motivational quote) from the DB on each `/chat/send`, so Profile edits take effect on the very next reply with no restart needed.
- **Defense in depth on prompt size.** Profile fields have `maxLength` constraints in OpenAPI/Zod **and** are clipped server-side before being concatenated into the chat system prompt, so a drifted DB value can't bloat the prompt.
- **Idempotent daily logs.** Endpoints like medication-log-for-today use unique constraints on `(userId, date)` so double-taps don't create duplicates.

## Product

Kindred-Asterling-AI-Coaching helps people care for themselves with structure and warmth. Today it supports:

- **Dashboard** — daily affirmation, streak summaries, and quick links into the day's check-ins
- **Morning** — mental-load check-in to start the day
- **Body Scans** — log physical sensations and how medications are landing
- **Evening** — reflection prompts to close the day
- **Habits** — daily habits with streak tracking
- **Medications** — list with times, "X / Y taken today" counter, one-tap mark-as-taken
- **Profile** — preferred name, birthday, bio, motivational quote, and "what Kindred should know" (struggles / strengths / interests) — all of which the AI references
- **Chat with Kindred** — a Claude-powered coach that reflects, asks specific (non-generic) follow-ups, and respects what's in your profile
- **Archive** — historical view of past entries

## User preferences

- App is named **Kindred-Asterling-AI-Coaching**; the in-app AI persona is **Kindred**.
- Chat AI should sound human and grounded — **no** generic filler ("tell me more", "go on"), one focused move per reply, follow-up questions must be specific to what the user actually said.
- Sidebar is a single collapsible left rail (no separate mobile bottom nav); collapse state persists across sessions.

## Gotchas

- **Always restart the `artifacts/api-server: API Server` workflow** after editing anything under `artifacts/api-server/src/**` — esbuild bundle won't auto-reload.
- **After changing `openapi.yaml`,** run `pnpm --filter @workspace/api-spec run codegen` before typechecking — otherwise the frontend will reference stale generated hooks.
- **After changing `lib/db/src/schema/**`,** run `pnpm --filter @workspace/db run push` to apply to dev DB. Production DB needs a separate push after deploy.
- **Do not run `pnpm dev` from the workspace root** — use the per-artifact workflows (they set `PORT` / `BASE_PATH`).
- **Codegen names follow Orval conventions:** request bodies are e.g. `CreateMedicationBody` / `UpdateMedicationBody`, not `MedicationInput`.
- **Express 5 quirk:** `req.params.id` is typed `string | string[] | undefined`; route handlers use a `parseId()` helper to normalize.
- **Never use `console.log` in server code** — use `req.log` in route handlers and the singleton `logger` elsewhere.
- **Drizzle date columns serialize as `Date` objects** — when returning rows through JSON.stringify-validated responses, rely on the existing `JSON.parse(JSON.stringify(row))` pattern in `/auth/user` and similar handlers.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `threat_model.md` for the security posture and trust boundaries
