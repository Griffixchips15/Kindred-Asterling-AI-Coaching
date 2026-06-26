---
name: Subscription paywall (Square)
description: The non-obvious, cross-session rules of the whole-app Square subscription gate (durable lessons only — config lives in replit.md).
---

# Whole-app Square subscription paywall — durable lessons

(Config, env vars, route names, and flow are documented in `replit.md`; this file keeps only the rules that aren't obvious from the code.)

## Trust anchor: email matching
Entitlement is matched by **email** — the app login email (Replit OIDC) must equal the Square payer's email. Identity is always derived from the session (`req.user`), never from client input.
**Why:** it relies on the OIDC email claim being owned by the user; that is the core trust assumption of the whole gate.

## Fail closed — the rule that bit us in review
`resolveSubscription()` must **never** grant access from a stale cached "active" row when Square can't be verified.
- Square unconfigured → deny (even if a cached active row exists).
- Live Square check throws → deny (do not serve stale cache).
- The cache only grants a recent (within TTL) *successful* verification.
**Why:** an availability failure (Square down/misconfigured) must not silently become continued authorization. The first implementation fell back to cached-active on error/unconfigured and review flagged it.
**How to apply:** order is bypass-allowlist → fail-closed-if-unverifiable → fresh-cache → live check. Keep the unconfigured/error branches returning inactive.

## Owner lockout trap
With Square misconfigured, *everyone* is locked out. Put the owner's email in `SUBSCRIPTION_BYPASS_EMAILS` (comma-separated, lowercased) so they're never locked out.

## Webhook signature gotcha
`POST /api/square/webhook` has no session; it's verified by HMAC-SHA256 over `SQUARE_WEBHOOK_URL` + the **raw** request body. The registered URL must byte-for-byte match `SQUARE_WEBHOOK_URL` or verification fails (401). Raw bytes come from the `express.json({ verify })` hook in `app.ts` (`req.rawBody`) — don't remove it.

## Test mode
`requireSubscription` is skipped when `NODE_ENV==="test"` so HTTP tests don't each need a subscription. The service is unit-tested directly by mocking `./squareClient`.
