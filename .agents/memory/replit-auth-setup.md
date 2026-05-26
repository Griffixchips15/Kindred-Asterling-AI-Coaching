---
name: Replit Auth setup
description: How Replit Auth is wired in Kindred Coach — session, middleware, userId scoping.
---

# Replit Auth in Kindred Coach

**Why:** User requested auth so each person's data stays private.

**How to apply:** Auth is live. When adding new routes, always add `requireAuth` middleware and filter/insert with `req.user!.id`.

## Key files
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — loads user from session on every request
- `artifacts/api-server/src/middlewares/requireAuth.ts` — 401 guard for protected routes
- `artifacts/api-server/src/lib/auth.ts` — OIDC config, session CRUD, user upsert
- `artifacts/api-server/src/routes/auth.ts` — /login /callback /logout routes
- `lib/replit-auth-web/` — composite lib exposing `useAuth()` hook for the frontend
- `lib/db/src/schema/auth.ts` — `sessions` and `users` tables (do NOT drop these)

## userId scoping
All 5 data tables (morning_logs, body_scans, evening_reports, habits, habit_entries via habit ownership) have a nullable `user_id varchar` column. Every SELECT filters by `eq(table.userId, userId)` and every INSERT includes `userId`.

## Lib rebuild gotcha
After editing any `lib/db/src/schema/*.ts` file, run `pnpm run typecheck:libs` before typechecking the api-server, or the old cached declarations will cause TS2339 "property does not exist" errors.

## replit-auth-web lib type gotcha
The `lib/replit-auth-web` template uses `import.meta.env.BASE_URL`. Added `lib/replit-auth-web/src/vite-env.d.ts` to declare `ImportMeta.env` so `tsc --build` doesn't error.
