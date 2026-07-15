---
name: Subscription paywall (Stripe)
description: The non-obvious, cross-session rules of the whole-app Stripe subscription gate (durable lessons only — config lives in replit.md).
---

# Whole-app Stripe subscription paywall — durable lessons

(Config, env vars, route names, and flow are documented in `replit.md`; this file keeps only the rules that aren't obvious from the code.)

## Trust anchor: email matching
Entitlement is matched by **email** — the app login email must equal the Stripe payer's email. Identity is always derived from the session (`req.user`), never from client input.
**Why:** it relies on the email claim being owned by the user; that is the core trust assumption of the whole gate.

## Fail closed — the rule that bit us in review
`resolveSubscription()` must **never** grant access from a stale cached "active" row when Stripe can't be verified.
- Stripe unconfigured → deny (even if a cached active row exists).
- Live Stripe check throws → deny (do not serve stale cache).
- The cache only grants a recent (within TTL) *successful* verification.
**Why:** an availability failure (Stripe down/misconfigured) must not silently become continued authorization. The first implementation fell back to cached-active on error/unconfigured and review flagged it.
**How to apply:** order is bypass-allowlist → fail-closed-if-unverifiable → fresh-cache → live check. Keep the unconfigured/error branches returning inactive.

## Owner lockout trap
With Stripe misconfigured, *everyone* is locked out. Put the owner's email in `SUBSCRIPTION_BYPASS_EMAILS` (comma-separated, lowercased) so they're never locked out.

## Webhook signature gotcha
`POST /api/stripe/webhook` has no session; it's verified by Stripe's webhook signature using `STRIPE_WEBHOOK_SECRET`. Raw bytes come from the `express.json({ verify })` hook in `app.ts` (`req.rawBody`) — don't remove it.

## Test mode
`requireSubscription` is skipped when `NODE_ENV==="test"` so HTTP tests don't each need a subscription. The service is unit-tested directly by mocking `./stripeClient`.
