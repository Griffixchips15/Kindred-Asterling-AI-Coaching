# Kindred-Asterling-AI-Coaching

A personal wellness companion web app. Users journal their day (morning check-ins, body scans, evening reflections), track habits and medications, and chat with **Kindred**, a Claude-powered AI coach that knows their profile and history.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Pino logging + OIDC (Replit Auth) sessions
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + Tailwind + React Query + Wouter
- AI: provider-neutral server interface; select `ollama`, `openai`, or `disabled` with `AI_PROVIDER`
- Validation: Zod (`zod/v4`) + `drizzle-zod`; API codegen: Orval (hooks + Zod from OpenAPI)
- Integrations: Google Calendar (installed, available for future use)

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/kindred-coach run dev` — web frontend
- `pnpm run typecheck` / `pnpm run build` — full typecheck / typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — regen hooks + Zod from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema (dev only; prod needs a separate push after deploy)

### Environment variables

- **Core:** `DATABASE_URL` and `SESSION_SECRET`; AI variables are required only for the provider selected by `AI_PROVIDER`.
- **Voice:** `ELEVENLABS_API_KEY` (STT + Kindred read-aloud). Unset → voice endpoints return 503, UI soft-fails.
- **Reminders (fail-soft per channel):** SMS via Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`); email via Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Unset secrets → that channel is skipped; the other still sends and the UI still saves prefs. Senders use env secrets directly (the Twilio connector proxy errored 20003). **Reminders only fire while the server runs — requires a Reserved VM (always-on) deploy.**
- **Subscription/Helcim (fail closed):** secrets `HELCIM_API_KEY`, `HELCIM_WEBHOOK_SECRET`; vars `HELCIM_YEARLY_CHECKOUT_URL`, `HELCIM_LIFETIME_CHECKOUT_URL`, `HELCIM_PORTAL_URL`, `SUBSCRIPTION_OWNER_IDS` (immutable user IDs for owner bypass). Missing `HELCIM_API_KEY` → Helcim path locked, but owner/beta bypass still works.
- **Subscription/owner bypass:** `SUBSCRIPTION_OWNER_IDS` (comma-separated immutable user IDs). Owners get unconditional access via `resolveSubscription()` before any Helcim or beta check.

## Where things live

- **DB schema (source of truth):** `lib/db/src/schema/*` — every user-data table has a `userId` FK that cascades on delete
- **API contract (source of truth):** `lib/api-spec/openapi.yaml` — never hand-edit generated client/zod files
- **API routes:** `artifacts/api-server/src/routes/*` — all data routes scoped to `req.user!.id` behind `requireAuth`
- **Auth:** `artifacts/api-server/src/routes/auth.ts` (Replit OIDC + session cookies)
- **AI chat:** system prompt `chat.ts → buildSystemInstruction()`; tools + executor `lib/chatTools.ts` (agentic loop in `/chat/send`)
- **Subscription/paywall:** backend `lib/subscriptionService.ts` (`resolveSubscription` — checks owner IDs → beta grants → Helcim cache), `middlewares/requireSubscription.ts`, `routes/subscription.ts` (status + Helcim checkout + webhook), `lib/helcimClient.ts` (Helcim API + webhook verification), schema `lib/db/src/schema/subscriptions.ts`, `lib/db/src/schema/beta.ts` (beta grants); frontend `SubscriptionGate` in `App.tsx` + `components/checkout-button.tsx`
- **Voice:** backend `lib/elevenlabs.ts` (Scribe STT + TTS, voice "River") + `routes/voice.ts` (`/voice/transcribe`, `/voice/speak` — binary, bypass codegen); frontend `lib/voice-api.ts`, `hooks/use-voice-recorder.ts`, `components/voice-input-button.tsx` + `speak-button.tsx`
- **Reminders:** backend `lib/reminderScheduler.ts` (cron + `runReminderTick()`), senders `lib/twilio.ts` + `lib/resend.ts`, `routes/reminders.ts` (`GET/PUT /reminder-settings`, tagged `profile`), schema `lib/db/src/schema/reminders.ts` (`reminder_settings`, `reminder_deliveries` ledger). Phone + timezone live on `usersTable`. Frontend `pages/reminders.tsx` (routed `/reminders`)
- **Frontend pages:** `artifacts/kindred-coach/src/pages/*` (dashboard, morning, scans, evening, habits, medications, reports, chat, profile, archive); marketing in `pages/public/*` wrapped by `components/layout/public-layout.tsx`
- **Feelings Wheel data:** `lib/feelings-wheel.ts` — Body Scan emotion picker source (frontend-only; emotions stored as plain `string[]`, so edits need no backend/openapi change)
- **Layout/theme:** `components/layout/app-layout.tsx` (collapsible sidebar, localStorage); `hooks/use-theme.tsx` + `index.css` (light/dark + accents)

## Architecture decisions

- **Contract-first API.** Edit `openapi.yaml` and regen — Orval generates the client + Zod validators. Never hand-edit generated files.
- **Per-user data isolation.** Every data table has a `userId` FK; every route filters by `req.user!.id`. Journal content is treated as sensitive.
- **Chat re-reads profile every turn.** `buildSystemInstruction()` pulls fresh user fields from the DB on each `/chat/send`, so Profile edits apply on the next reply with no restart. Profile fields are length-capped in Zod **and** clipped server-side before prompt concatenation.
- **Chat tool-calling is server-scoped.** Kindred's tools read the user's own habits/streaks/meds/recent logs mid-conversation, always scoped to the session user (model never supplies identity), outputs omit row IDs. Loop runs while `stop_reason==="tool_use"`, capped at 4 iterations.
- **Idempotent daily logs.** Unique constraints on `(userId, date)` so double-taps don't duplicate.
- **Medication schedule history.** `medication_schedule_entries` records each scheduled time with its effective date range (`startDate` incl., `endDate` excl., NULL = active), reconciled via `reconcileScheduleEntries()`. The weekly report judges each past day against the schedule actually in effect then — editing times only affects days forward.
- **Subscription paywall (fail closed).** App is locked until the signed-in user has access via one of three paths checked in order: (1) owner ID (`SUBSCRIPTION_OWNER_IDS`), (2) beta grant (`beta_grants` table), (3) Helcim subscription cache (`subscriptions` table, upserted by webhook). `resolveSubscription()` returns `{active, status, source}` where source is `owner`, `beta`, `helcim`, or `none`. If Helcim is unconfigured or errors, access is **denied** — never served from stale cache. `requireSubscription` returns 402 when inactive (skipped only under `NODE_ENV==="test"`). Webhook `POST /api/payment/webhook` (HMAC over URL + raw body) upserts the user's cached Helcim subscription row. `SubscriptionGate` sends non-subscribers to `/pricing`.
- **In-app Helcim checkout.** `POST /api/subscription/checkout` (behind `requireAuth`, **not** `requireSubscription`; body `{planType: yearly|lifetime}`) returns the Helcim hosted checkout URL. 503 if unconfigured (Helcim API key or checkout URLs missing). Redirects to Helcim's hosted page; Helcim redirects back to `/payment-success`, which re-checks status (entitlement granted async via webhook) before entering `/app`.
- **Marketing + app share one frontend, split by route.** Public pages ungated at `/`, `/about`, `/science`, `/pricing`, `/payment-success`; coaching app under a Wouter **nested** `<Route path="/app" nest>` wrapped in `AuthGate → SubscriptionGate → AppLayout`. In-app links stay relative (`/chat` → `/app/chat`); link out with Wouter's `~/` prefix (e.g. `~/pricing`).
- **Scheduled reminders (cron + idempotency ledger).** One every-minute `node-cron` tick computes each user's due reminders **in their own timezone** and sends over their chosen channels. Guarantees: (1) **catch-up window** — fires on the first tick at/after scheduled local time, up to 10 min late, so a skipped tick doesn't drop it but old ones can't replay; (2) **atomic once-only** — `deliverOnce()` reserves the ledger row first (`INSERT … ON CONFLICT DO NOTHING … RETURNING`); only the winner sends; a failed send deletes the reservation so a later in-window tick retries; (3) **no overlap** — a `ticking` guard skips a tick if the prior is still running. Med reminders read schedule entries active that day. `runReminderTick()` is unit-tested; scheduler skipped under `NODE_ENV==="test"`.
- **Voice journaling (ElevenLabs).** STT uses browser `MediaRecorder` (Web Speech API is missing on many mobile browsers, e.g. Brave/Android) → `/voice/transcribe`; TTS reads Kindred's replies via `/voice/speak`. Binary audio, so they **bypass codegen** (direct `fetch`, same-origin cookie). Gated by `requireAuth` + `requireSubscription`; in-flight requests aborted on stop/unmount.

## Product

Kindred helps people care for themselves with structure and warmth:

- **Dashboard** — daily affirmation, streak summaries, quick links into the day's check-ins
- **Morning** — mental-load check-in
- **Body Scans** — tag emotions via a searchable Feelings Wheel (7 cores → secondary → tertiary, or search; up to 20), energy slider, physical sensations, notes
- **Evening** — reflection prompts to close the day
- **Habits** — daily habits with streak tracking
- **Medications** — multiple scheduled times/day; per-dose taken-checkbox + 1–10 effectiveness rating + "X / Y doses taken today"
- **Reports** — combined 7-day grid; each dose shows On time / Missed / Upcoming (late = Missed) against a 1-hour window in local time; past days reflect the schedule in effect that day
- **Profile** — preferred name, birthday, bio, motivational quote, and "what Kindred should know" (struggles / strengths / interests) — all referenced by the AI
- **Chat with Kindred** — a Claude coach that reflects, asks specific follow-ups, respects the profile, and can pull your own recent data mid-conversation (scoped to your account)
- **Voice** — mic on any journal field or chat box to speak instead of type; speaker on Kindred's replies to hear them read aloud (ElevenLabs)
- **Reminders** — opt-in nudges for morning / medication / evening, by text and/or email at times you choose in your timezone (Reminders page)
- **Archive** — historical view of past entries
- **Marketing site** — public landing, About, Science, Pricing pages
- **Subscription** — whole app behind a paywall; pick a plan on `/pricing`, pay via Helcim hosted checkout with your login email, access unlocks once Helcim reports active

## User preferences

- App is named **Kindred-Asterling-AI-Coaching**; the in-app AI persona is **Kindred**.
- Owner is non-technical and phone-only (Brave/Android) — keep communication plain, no jargon.
- Subscriptions sold via **Helcim hosted checkout** from `/pricing` — users redirected to Helcim for payment. Identity matched by email + user ID. Whole app is gated.
- Chat AI should sound human and grounded — **no** generic filler ("tell me more", "go on"); one focused move per reply; follow-ups specific to what the user said.
- Sidebar is a single collapsible left rail (no separate mobile bottom nav); collapse state persists.

## Gotchas

- **Restart `artifacts/api-server: API Server`** after editing `artifacts/api-server/src/**` — esbuild bundle won't auto-reload.
- **After editing `openapi.yaml`,** run codegen before typecheck (else the frontend uses stale hooks). Orval names request bodies `CreateMedicationBody` / `UpdateMedicationBody` (not `MedicationInput`).
- **After editing `lib/db/src/schema/**`,** run `db push` for dev; prod needs a separate push after deploy.
- **Multi-dose meds migration:** meds use `times` text[] (not `time_of_day`); logs carry `scheduled_time`. On a prod DB with the old column, run `pnpm --filter @workspace/db run migrate` (idempotent SQL in `lib/db/migrations/*`) **before** `drizzle-kit push`, or a plain push drops data.
- **Helcim webhook signature is over raw body + `webhook-id` / `webhook-timestamp` / `webhook-signature` headers.** `app.ts` captures `req.rawBody` via the `express.json({ verify })` hook — don't remove it. Ping (no signature headers) is answered with 200.
- **Subscription is fail closed.** Missing/misconfigured Helcim secrets lock out everyone except owners in `SUBSCRIPTION_OWNER_IDS` — keep your immutable user ID there.
- **In-app checkout needs Helcim checkout URLs** (`HELCIM_YEARLY_CHECKOUT_URL`, `HELCIM_LIFETIME_CHECKOUT_URL`) or `/api/subscription/checkout` returns 503 (Pricing page still renders).
- **Reminders need an always-on server.** In-process cron only fires while the API runs — deploy on a **Reserved VM** (Autoscale sleeps when idle). No external scheduler.
- **Reminder senders are fail-soft** (unlike the subscription gate): missing `TWILIO_*` / `RESEND_*` just skips that channel; settings still save.
- **Voice endpoints bypass codegen** (binary audio) — not in `openapi.yaml`, called via raw `fetch`. Don't generate Orval hooks for them.
- **The coaching app lives under `/app` (nested route).** New in-app pages go inside the `<Route path="/app" nest>` Switch in `App.tsx` with relative links; new public pages go in the top-level Switch wrapped in `PublicLayout`; link out from `/app` with `~/`.
- **Do not run `pnpm dev` from the workspace root** — use the per-artifact workflows (they set `PORT` / `BASE_PATH`).
- **Express 5:** `req.params.id` is `string | string[] | undefined`; use the `parseId()` helper.
- **Never `console.log` in server code** — use `req.log` in handlers, the singleton `logger` elsewhere.
- **Drizzle date columns serialize as `Date`** — wrap rows in `JSON.parse(JSON.stringify(row))` before Zod-validated responses (see `/auth/user`).

## Pointers

- `pnpm-workspace` skill — workspace structure, TypeScript setup, package details
- `threat_model.md` — security posture and trust boundaries
