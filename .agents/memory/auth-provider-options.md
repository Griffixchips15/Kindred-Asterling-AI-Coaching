---
name: Auth provider options
description: What auth this app uses and the hard constraint on switching providers
---

# Auth provider options

The app authenticates with **Replit Auth (OIDC, "Sign in with Replit")** via `openid-client` + server sessions. The subscription/paywall entitlement is bound to the **email** from that login.

## Hard constraint: do NOT migrate Replit Auth → Clerk

Replit does **not** support migrating an app that already uses Replit Auth over to Clerk. There is no automated migration, and a hand-rolled swap is explicitly disallowed by the `clerk-auth` skill ("Intent: Migrating from Replit Auth — not currently supported … do not attempt a manual migration").

**Why:** swapping providers would rebuild the entire login from scratch and break both existing sign-ins and the email→subscription binding on a live paying app.

**How to apply:** if the user asks for Clerk (e.g. to get passkeys or a branded login), do not start the migration. Explain it isn't supported yet. What *is* safe to deliver: brand the app's own pre-login welcome screen (the `AuthGate` unauthenticated state in `App.tsx`) — the Replit-hosted OAuth popup itself can't be themed. Passkeys are only available via Clerk, so they're blocked until Replit supports the Replit-Auth→Clerk move.
