---
name: Subscription paywall (Square)
description: How the whole-app Square subscription gate is designed and the non-obvious rules that must hold.
---

# Whole-app Square subscription paywall

The entire app is gated: a signed-in user gets nothing until they have an ACTIVE Square subscription. There is **no in-app checkout** — users subscribe on the owner's **external Square store page** (`SQUARE_STORE_URL`).

## Trust anchor: email matching
Entitlement is matched by **email**: the app login email (Replit OIDC) must equal the Square payer's email. Identity is always derived from the session (`req.user`), never from client input. This is the core trust assumption — it relies on the OIDC email claim being owned by the user.

## Fail closed — the rule that bit us in review
`resolveSubscription()` must **never** grant access from a stale cached "active" row when Square can't be verified.
- Square unconfigured → deny (even if a cached active row exists).
- Live Square check throws → deny (do not serve stale cache).
- The ONLY thing the cache grants is a recent (within 5-min TTL) *successful* verification.
**Why:** an availability failure (Square down / misconfigured) must not silently become continued authorization. The first implementation fell back to cached-active on error/unconfigured and a code review flagged it.
**How to apply:** order is bypass-allowlist → fail-closed-if-unverifiable → fresh-cache → live check. Keep the unconfigured/error branches returning inactive.

## Owner access
With Square misconfigured, *everyone* is locked out. `SUBSCRIPTION_BYPASS_EMAILS` (comma-separated, lowercased) is an allowlist that always gets access — put the owner's email there so they're never locked out.

## Webhook signature
`POST /api/square/webhook` has no session auth; it is verified by HMAC-SHA256 over `SQUARE_WEBHOOK_URL` + the raw request body. The URL must byte-for-byte match what's registered in Square or verification fails. Raw bytes come from the `express.json({ verify })` hook in `app.ts` (`req.rawBody`) — don't remove it.

## Test mode
`requireSubscription` middleware is skipped when `NODE_ENV==="test"` so the existing 130+ HTTP tests don't each need a subscription. The service itself is unit-tested directly (mock `./squareClient`).
