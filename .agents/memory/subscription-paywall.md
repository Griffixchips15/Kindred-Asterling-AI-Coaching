---
name: Subscription paywall (Helcim)
description: The non-obvious, cross-session rules of the whole-app Helcim subscription gate (durable lessons only — config lives in replit.md).
---

# Whole-app Helcim subscription paywall — durable lessons

(Config, env vars, route names, and flow are documented in `replit.md`; this file keeps only the rules that aren't obvious from the code.)

## Access resolution order
`resolveSubscription()` checks three sources in order:
1. **Owner IDs** (`SUBSCRIPTION_OWNER_IDS`) — immutable user IDs, first check
2. **Beta grants** (`beta_grants` table) — non-revoked, non-expired grants
3. **Helcim cache** (`subscriptions` table) — webhook-upserted subscription row

If none match, access is denied.

## Fail closed — the rule that bit us in review
`resolveSubscription()` must **never** grant access from a stale cached "active" row when no payment provider can be verified.
- Helcim unconfigured → deny (even if a cached active row exists).
- Any DB error → deny (do not serve stale cache).
**Why:** an availability failure must not silently become continued authorization.

## Owner lockout trap
With Helcim misconfigured (no bank account linked), *everyone except owners* is locked out. Put your immutable user ID in `SUBSCRIPTION_OWNER_IDS` (comma-separated) so you're never locked out. This is the bootstrap path.

## Owner IDs, not emails
Legacy bypass was `SUBSCRIPTION_BYPASS_EMAILS` (email-based). Now uses `SUBSCRIPTION_OWNER_IDS` — immutable user IDs. This avoids the problem of email changes and case-insensitivity.

## Beta grants
Beta access is managed via `beta_grants` table. Grants can have an optional `expiresAt`. Revocation sets `revokedAt` + `revokedBy`. All mutations are audited in `entitlement_audit`.

## Webhook dedup
Helcim webhooks are deduplicated in PostgreSQL via the `processed_webhooks` table with `ON CONFLICT (webhook_id) DO NOTHING`. The in-memory Map approach was replaced because it doesn't survive restarts.

## Webhook payload validation
Event types are explicitly whitelisted before modifying access. Unknown event types are logged and skipped — they never touch entitlement state.

## Audit logging
Every entitlement change (helcim event, beta grant, beta revoke) is recorded in `entitlement_audit` with actor, metadata, and timestamp. Wellness/session content is never logged.

## Webhook signature gotcha
`POST /api/payment/webhook` has no session; it's verified by Helcim's webhook signature using `HELCIM_WEBHOOK_SECRET`. Raw bytes come from the `express.json({ verify })` hook in `app.ts` (`req.rawBody`) — don't remove it.

## Test mode
`requireSubscription` is skipped when `NODE_ENV==="test"` so HTTP tests don't each need a subscription. The service is unit-tested directly against the DB with real queries.
