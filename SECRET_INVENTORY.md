# Secret Inventory — Kindred AI Server AI Coaching

> **Purpose:** Single source of truth for where every secret lives, who owns it, and how it reaches each environment.
> **Last updated:** 2025-07-17

---

## Ownership Model

| Owner               | Responsibility                                                                       |
| ------------------- | ------------------------------------------------------------------------------------ |
| **1Password**       | Passwords, recovery codes, API keys, account ownership, local secret injection       |
| **Stripe Projects** | Provider account provisioning, provider billing                                      |
| **Coolify**         | Self-hosted (Coolify): hosting, PostgreSQL, production runtime environment variables |
| **Git**             | Source code, non-secret configuration, `.env.example`, `.env.1password`              |

---

## Vault: `Kindred AI Server`

### Items (created via CLI)

| 1Password Item | Tags | Populated? |
|---|---|---|
| Kindred - Database Development | `environment/development` `service/coolify` | **Needs dev URL** |
| Kindred - Database Production | `environment/production` `service/coolify` | ✅ In 1Password |
| Kindred - Session Secret | `environment/development` | ✅ In 1Password |
| Kindred - ElevenLabs Development | `environment/development` `service/elevenlabs` | ✅ In 1Password |
| Kindred - ElevenLabs Production | `environment/production` `service/elevenlabs` | **Needs API key** |
| Kindred - Stripe Test | `environment/development` `service/stripe` | **Needs test keys** |
| Kindred - Stripe Production | `environment/production` `service/stripe` | ✅ Key + webhook populated, **needs price IDs** |
| Kindred - Twilio Development | `environment/development` `service/twilio` | **Needs credentials** |
| Kindred - Twilio Production | `environment/production` `service/twilio` | **Needs credentials** |
| Kindred - Resend Development | `environment/development` `service/resend` | ✅ In 1Password |
| Kindred - Resend Production | `environment/production` `service/resend` | ✅ Same key, **needs from email** |
| Kindred - App Config | `environment/development` | ✅ Pre-filled |
| Kindred - Owner Recovery Codes | | **Needs codes** |
| Kindred - Cloudflare | `service/cloudflare` | ✅ In 1Password |
| Kindred - GitLab | `service/gitlab` | ✅ In 1Password |
| Kindred - Twilio Recovery | `service/twilio` | ✅ In 1Password |

---

## Secret-by-Secret Inventory

### Database

| Variable       | 1Password Item                 | 1Password Field | Dev Source                    | Production Source                    |
| -------------- | ------------------------------ | --------------- | ----------------------------- | ------------------------------------ |
| `DATABASE_URL` | Kindred - Database Development | `credential`    | `.env.1password` via `op run` | Coolify env var (set from 1Password) |

### Authentication (Clerk)

Clerk owns identity, email verification, sessions, and account security. Configure `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and `CLERK_WEBHOOK_SECRET` in the deployment secret store; the legacy `SESSION_SECRET` is retired.


| Variable | 1Password Item | 1Password Field | Dev Source | Production Source |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Kindred - Anthropic Development | `api key` | `.env.1password` via `op run` | Coolify env var |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Kindred - Anthropic Development | `api key` | `.env.1password` via `op run` | Coolify env var |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Kindred - Anthropic Development | `base url` | `.env.1password` via `op run` | Coolify env var |


| Variable | 1Password Item | 1Password Field | Dev Source | Production Source |
|---|---|---|---|---|
| `GEMINI_API_KEY` | Kindred - Gemini Development | `api key` | `.env.1password` via `op run` | Coolify env var |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Kindred - Gemini Development | `api key` | `.env.1password` via `op run` | Coolify env var |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Kindred - Gemini Development | `base url` | `.env.1password` via `op run` | Coolify env var |

### Payments: Stripe

| Variable                   | 1Password Item        | 1Password Field     | Dev Source                    | Production Source                                  |
| -------------------------- | --------------------- | ------------------- | ----------------------------- | -------------------------------------------------- |
| `STRIPE_SECRET_KEY`        | Kindred - Stripe Test | `secret key`        | `.env.1password` via `op run` | Coolify env var (from Kindred - Stripe Production) |
| `STRIPE_YEARLY_PRICE_ID`   | Kindred - Stripe Test | `yearly price id`   | `.env.1password` via `op run` | Coolify env var (from Kindred - Stripe Production) |
| `STRIPE_LIFETIME_PRICE_ID` | Kindred - Stripe Test | `lifetime price id` | `.env.1password` via `op run` | Coolify env var (from Kindred - Stripe Production) |
| `STRIPE_WEBHOOK_SECRET`    | Kindred - Stripe Test | `webhook secret`    | `.env.1password` via `op run` | Coolify env var (from Kindred - Stripe Production) |

### Messaging: SMS (Twilio)

| Variable              | 1Password Item               | 1Password Field | Dev Source                    | Production Source |
| --------------------- | ---------------------------- | --------------- | ----------------------------- | ----------------- |
| `TWILIO_ACCOUNT_SID`  | Kindred - Twilio Development | `account sid`   | `.env.1password` via `op run` | Coolify env var   |
| `TWILIO_AUTH_TOKEN`   | Kindred - Twilio Development | `auth token`    | `.env.1password` via `op run` | Coolify env var   |
| `TWILIO_PHONE_NUMBER` | Kindred - Twilio Development | `phone number`  | `.env.1password` via `op run` | Coolify env var   |

### Messaging: Email (Resend)

| Variable            | 1Password Item               | 1Password Field | Dev Source                    | Production Source |
| ------------------- | ---------------------------- | --------------- | ----------------------------- | ----------------- |
| `RESEND_API_KEY`    | Kindred - Resend Development | `api key`       | `.env.1password` via `op run` | Coolify env var   |
| `RESEND_FROM_EMAIL` | Kindred - Resend Development | `from email`    | `.env.1password` via `op run` | Coolify env var   |

### Voice: ElevenLabs

| Variable             | 1Password Item                   | 1Password Field | Dev Source                    | Production Source |
| -------------------- | -------------------------------- | --------------- | ----------------------------- | ----------------- |
| `ELEVENLABS_API_KEY` | Kindred - ElevenLabs Development | `api key`       | `.env.1password` via `op run` | Coolify env var   |

### Application / Runtime (non-secret, but environment-specific)

| Variable                     | Source                     | Dev Value                     | Production Value                            |
| ---------------------------- | -------------------------- | ----------------------------- | ------------------------------------------- |
| `PORT`                       | Coolify / `.env.1password` | `8080`                        | Coolify default                             |
| `NODE_ENV`                   | `.env.1password` / Coolify | `development`                 | `production`                                |
| `APP_PUBLIC_URL`             | `.env.1password` / Coolify | `http://localhost:8080`       | `https://kindred-asterling-ai-coaching.com` |
| `LOG_LEVEL`                  | `.env.1password` / Coolify | `debug`                       | `info`                                      |
| `CALENDAR_OWNER_USER_ID`     | Kindred - App Config       | `50312031`                    | `50312031`                                  |
| `SUBSCRIPTION_BYPASS_EMAILS` | Kindred - App Config       | `asterling.digital@pm.me,...` | (same or production-only)                   |

### Additional: Cloudflare

| Variable        | 1Password Item       | 1Password Field | Source  |
| --------------- | -------------------- | --------------- | ------- |
| `CLOUDFARE_API` | Kindred - Cloudflare | `api token`     | Coolify |

### Additional: GitLab

| Variable                   | 1Password Item   | 1Password Field | Source  |
| -------------------------- | ---------------- | --------------- | ------- |
| `GIT_URL` (token embedded) | Kindred - GitLab | `access token`  | Coolify |

### Additional: Twilio Recovery

| Variable             | 1Password Item            | 1Password Field | Source  |
| -------------------- | ------------------------- | --------------- | ------- |
| `Twilio_recoveryKey` | Kindred - Twilio Recovery | `recovery key`  | Coolify |

### Legacy: Square (deprecated — do not use for new code)

| Variable                       | Status    | Notes             |
| ------------------------------ | --------- | ----------------- |
| `SQUARE_ACCESS_TOKEN`          | Dead code | Remove when ready |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Dead code | Remove when ready |
| `SQUARE_ENVIRONMENT`           | Dead code | Remove when ready |
| `SQUARE_STORE_URL`             | Dead code | Remove when ready |
| `SQUARE_LOCATION_ID`           | Dead code | Remove when ready |
| `SQUARE_YEARLY_VARIATION_ID`   | Dead code | Remove when ready |
| `SQUARE_LIFETIME_VARIATION_ID` | Dead code | Remove when ready |

---

## Items Still Needing Manual Input

Run `op edit "Kindred - <item name>"` to fill these:

| Item | Field(s) to fill | Where to find the value |
|---|---|---|
| Kindred - Database Development | `credential` | Local PostgreSQL or separate dev DB |
| Kindred - Anthropic Development | `api key` | https://console.anthropic.com/settings/keys |
| Kindred - Anthropic Production | `api key` | Same or separate prod key |
| Kindred - ElevenLabs Production | `api key` | https://elevenlabs.io/app/settings/api-keys |
| Kindred - Stripe Test | `secret key`, `yearly price id`, `lifetime price id`, `webhook secret` | https://dashboard.stripe.com/test/apikeys |
| Kindred - Stripe Production | `yearly price id`, `lifetime price id` | https://dashboard.stripe.com/prices |
| Kindred - Twilio Development | `account sid`, `auth token`, `phone numb
## Secret-by-Secret Inventory

### Database

| Variable       | 1Password Item                 | 1Password Field | Dev Source                    | Production Source                    |
| -------------- | ------------------------------ | --------------- | ---er` | https://console.twilio.com |
| Kindred - Twilio Production | `account sid`, `auth token`, `phone number` | Same account, prod credentials |
| Kindred - Resend Production | `from email` | Your verified domain email |
| Kindred - Owner Recovery Codes | `recovery codes` | 1Password recovery kit, backup codes |

## Rotation Procedure

1. Update the value in the 1Password item.
2. Update Coolify environment variables (for production secrets).
3. Deploy.
4. Verify the application starts and functions correctly.
5. Revoke or archive the old value if applicable.

## Files in This Repository

| File               | Purpose                                    | Committed?          |
| ------------------ | ------------------------------------------ | ------------------- |
| `.env.example`     | Variable names only — onboarding reference | Yes                 |
| `.env.1password`   | `op://` references — local dev injection   | Yes                 |
| `.env`             | Resolved secrets — local only              | **No** (gitignored) |
| `.env.*`           | Any other env file with real values        | **No** (gitignored) |
| `.projects/vault/` | Stripe Projects output                     | **No** (gitignored) |
