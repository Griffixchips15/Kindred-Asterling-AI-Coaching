# Secret Inventory — Kindred Asterling AI Coaching

> **Purpose:** Define every credential and sensitive runtime value used by the
> application, where it is stored, and when it is required.
>
> **Last reviewed:** 2026-08-28

This document records **names and storage locations only**. Never add secret
values to this file, `.env.example`, an image, a build argument, or a `VITE_*`
variable. The inventory describes the repository's current configuration
contract; it does not attest that an external vault item is populated or valid.

## Storage and delivery model

| System                                    | Responsibility                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| **1Password — `Kindred AI Server` vault** | Source of truth for developer credentials, recovery material, and references used by `op run` |
| **Coolify secret/environment store**      | Production runtime injection; sensitive values must be marked secret                          |
| **Git**                                   | Source code, this inventory, `.env.example`, and unresolved `op://` references only           |
| **Local `.env`**                          | Optional resolved developer values; ignored by Git and never shared                           |

Production secrets are copied or synchronized from the appropriate production
1Password item into Coolify. Local development should use unresolved references
in `.env.1password` with:

```sh
op run --env-file=.env.1password -- pnpm --filter @workspace/api-server run dev
```

## Secret-by-secret inventory

### Database

| Variable                 | Sensitivity / requirement                                                                          | Development source                              | Production source                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`           | **Secret; required.** Restricted application-role connection URL                                   | `Kindred - Database Development` / `credential` | Coolify secret from `Kindred - Database Production` / `credential` |
| `MIGRATION_DATABASE_URL` | **Secret; migration environment only.** Never provide it to the application runtime                | Dedicated development migrator credential       | Trusted production migration environment secret                    |
| `PG_SSL_CA`              | Sensitive configuration when it contains a private/internal CA; optional for public-CA connections | Local trusted CA file/value                     | Coolify secret or mounted secret file                              |

Application and migration roles must remain separate. See
[`docs/postgresql-operations.md`](docs/postgresql-operations.md) for the required
least-privilege model.

### Authentication — Clerk

| Variable                     | Sensitivity / requirement                            | Development source                               | Production source                                                   |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `CLERK_SECRET_KEY`           | **Secret; required in production**                   | `Kindred - Clerk Development` / `secret key`     | Coolify secret from `Kindred - Clerk Production` / `secret key`     |
| `CLERK_WEBHOOK_SECRET`       | **Secret; required in production**                   | `Kindred - Clerk Development` / `webhook secret` | Coolify secret from `Kindred - Clerk Production` / `webhook secret` |
| `CLERK_PUBLISHABLE_KEY`      | Public server configuration; required in production  | Clerk development instance                       | Coolify environment value from Clerk production instance            |
| `VITE_CLERK_PUBLISHABLE_KEY` | Public build-time value; required by the browser app | Clerk development instance                       | Coolify build argument from Clerk production instance               |

Clerk owns identity, verification, and sessions. The retired `SESSION_SECRET`
must not be reintroduced.

### AI providers

| Variable                | Sensitivity / requirement                                                                            | Development source                                  | Production source                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `OPENAI_API_KEY`        | **Secret; required only when `AI_PROVIDER=openai`**                                                  | `Kindred - OpenAI Development` / `api key`          | Coolify secret from `Kindred - OpenAI Production` / `api key` |
| `AWS_ACCESS_KEY_ID`     | **Secret-adjacent identifier; optional.** Use only when workload identity is unavailable for Bedrock | Dedicated least-privilege development IAM principal | Coolify secret from dedicated production IAM principal        |
| `AWS_SECRET_ACCESS_KEY` | **Secret; optional.** Paired with the access-key ID                                                  | Same IAM item as above / `secret access key`        | Coolify secret from production IAM item                       |
| `AWS_SESSION_TOKEN`     | **Secret; optional and temporary**                                                                   | Temporary AWS credentials                           | Coolify secret only when temporary credentials are used       |

Ollama needs no credential. Prefer an IAM role/workload identity over static AWS
keys. Provider selection, model names, base URLs, regions, and timeouts are
non-secret configuration listed below.

### Payments — Helcim

| Variable                           | Sensitivity / requirement                                                      | Development source                                           | Production source                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `HELCIM_API_KEY`                   | **Secret; required when payments are enabled**                                 | `Kindred - Helcim Development` / `api key`                   | Coolify secret from `Kindred - Helcim Production` / `api key`               |
| `HELCIM_WEBHOOK_SECRET`            | **Secret; required when payments are enabled**                                 | Development Helcim webhook signing secret                    | Coolify secret from production webhook signing secret                       |
| `HELCIM_CUSTOMER_REFERENCE_SECRET` | **Secret; required when payments are enabled.** Application-generated HMAC key | `Kindred - Helcim Development` / `customer reference secret` | Coolify secret from the production Helcim item; use a distinct random value |

Helcim plan/product IDs, hosted checkout URLs, portal URL, invoice prefix, and
the temporary `HELCIM_EMAIL_MIGRATION_FALLBACK` flag are non-secret.

### Email, SMS, and voice

| Variable              | Sensitivity / requirement                                                  | Development source                             | Production source                                                 |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `RESEND_API_KEY`      | **Secret; required in production**                                         | `Kindred - Resend Development` / `api key`     | Coolify secret from `Kindred - Resend Production` / `api key`     |
| `RESEND_FROM_EMAIL`   | Non-secret; required in production                                         | Development Resend item / `from email`         | Coolify environment value using a verified sender                 |
| `TWILIO_ACCOUNT_SID`  | **Secret-adjacent identifier; optional as part of the complete SMS group** | `Kindred - Twilio Development` / `account sid` | Coolify secret from `Kindred - Twilio Production`                 |
| `TWILIO_AUTH_TOKEN`   | **Secret; optional as part of the complete SMS group**                     | Development Twilio item / `auth token`         | Coolify secret from production Twilio item                        |
| `TWILIO_PHONE_NUMBER` | Sensitive configuration; optional as part of the complete SMS group        | Development Twilio item / `phone number`       | Coolify secret from production Twilio item                        |
| `ELEVENLABS_API_KEY`  | **Secret; optional**                                                       | `Kindred - ElevenLabs Development` / `api key` | Coolify secret from `Kindred - ElevenLabs Production` / `api key` |

Configure all three Twilio variables together or leave all three unset.

### Google Calendar

| Variable                        | Sensitivity / requirement                                                                      | Development source                                    | Production source                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`              | Public identifier; optional as part of the complete Calendar group                             | `Kindred - Google Calendar Development` / `client id` | Coolify environment value from production OAuth client         |
| `GOOGLE_CLIENT_SECRET`          | **Secret; optional as part of the complete Calendar group**                                    | Development Calendar item / `client secret`           | Coolify secret from production OAuth client                    |
| `CALENDAR_OAUTH_STATE_SECRET`   | **Secret; optional as part of the complete Calendar group.** Application-generated signing key | Development Calendar item / `state secret`            | Coolify secret; distinct random production value               |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | **Secret; optional as part of the complete Calendar group.** Encrypts stored refresh tokens    | Development Calendar item / `token encryption key`    | Coolify secret; distinct random production value               |
| `GOOGLE_CALENDAR_REDIRECT_URI`  | Public configuration; optional as part of the complete Calendar group                          | Local callback URL                                    | Coolify environment value matching the production OAuth client |

Configure the entire Calendar group or none of it. Rotating
`CALENDAR_TOKEN_ENCRYPTION_KEY` requires a token migration or reconnecting all
affected calendars; do not replace it without a migration plan.

### Observability

| Variable            | Sensitivity / requirement                                                  | Development source                             | Production source                                                            |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `SENTRY_DSN`        | Treat as sensitive configuration; optional server DSN                      | Development Sentry project                     | Coolify secret/environment value                                             |
| `VITE_SENTRY_DSN`   | Public browser DSN by design                                               | Development Sentry project                     | Coolify build argument                                                       |
| `SENTRY_AUTH_TOKEN` | **Secret; browser source-map build only.** Never runtime, `VITE_*`, or ARG | Optional local build environment; never `.env` | Coolify Build Secret ID `sentry_auth_token`; mounted only for the Vite build |

Sentry environment, release, enabled, and trace-sampling variables are
non-secret. The Dockerfile maps the lowercase BuildKit secret ID
`sentry_auth_token` to `SENTRY_AUTH_TOKEN` only inside the Vite build step. A DSN
is not an account credential, but controlling its disclosure
reduces event-injection abuse.

## Non-secret runtime inventory

These values belong in `.env.example` and Coolify as ordinary environment
configuration. Values beginning with `VITE_` are embedded in browser JavaScript
at build time and must always be safe to disclose.

| Area                | Variables                                                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime             | `NODE_ENV`, `PORT`, `APP_PUBLIC_URL`, `BASE_PATH`, `LOG_LEVEL`, `TRUST_PROXY_HOPS`                                                                                                                                                       |
| AI                  | `AI_PROVIDER`, `AI_REQUEST_TIMEOUT_MS`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `AWS_REGION`, `BEDROCK_MODEL_ID`                                                                                           |
| Payments            | `HELCIM_PAYMENTS_ENABLED`, `HELCIM_YEARLY_PLAN_ID`, `HELCIM_LIFETIME_PRODUCT_ID`, `HELCIM_YEARLY_CHECKOUT_URL`, `HELCIM_LIFETIME_CHECKOUT_URL`, `HELCIM_LIFETIME_INVOICE_PREFIX`, `HELCIM_PORTAL_URL`, `HELCIM_EMAIL_MIGRATION_FALLBACK` |
| Subscription policy | `SUBSCRIPTION_OWNER_IDS`, `SUBSCRIPTION_OWNER_EMAILS`, `DAILY_CHAT_LIMIT`                                                                                                                                                                |
| Sentry              | `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`, `VITE_SENTRY_ENABLED`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE`, `VITE_SENTRY_TRACES_SAMPLE_RATE`                                                           |
| Social links        | `VITE_SOCIAL_WHATSAPP_URL`, `VITE_SOCIAL_INSTAGRAM_URL`, `VITE_SOCIAL_THREADS_URL`, `VITE_SOCIAL_FACEBOOK_URL`, `VITE_SOCIAL_X_URL`, `VITE_SOCIAL_LINKEDIN_URL`, `VITE_SOCIAL_GOOGLE_BUSINESS_URL`, `VITE_SOCIAL_PATREON_URL`            |

`REPLIT_DOMAINS` is a legacy platform-provided compatibility value and must not
be manually configured for Coolify.

## External account and recovery material

Keep provider passwords, MFA recovery codes, 1Password recovery material,
Cloudflare tokens, source-control access tokens, and Twilio recovery keys in
dedicated 1Password items. They are administrative credentials, not application
environment variables, and must not be copied into Coolify unless a deployment
job explicitly requires them.

## Rotation procedure

1. Create the replacement in the provider or generate a cryptographically random
   application secret.
2. Save it in the correct 1Password development or production item.
3. Update the corresponding Coolify secret for production.
4. Deploy and verify the affected integration and application health checks.
5. Revoke the old provider credential after verification.
6. Record the rotation date and owner in the vault item; never record the value
   in Git, tickets, logs, or chat.

Webhook rotations may require a short overlap where the provider supports it.
Encryption-key rotations require a data migration and must not follow the normal
single-value procedure.

## Repository files

| File                                   | Purpose                                             | Committed?          |
| -------------------------------------- | --------------------------------------------------- | ------------------- |
| `.env.example`                         | Variable names and safe example configuration       | Yes                 |
| `.env.1password`                       | Unresolved `op://` references for local development | Yes                 |
| `.env`                                 | Resolved local values                               | **No; Git-ignored** |
| Other `.env.*` files containing values | Environment-specific resolved values                | **No; Git-ignored** |

When adding or removing a runtime credential, update the configuration validator,
`.env.example`, `.env.1password` when local injection is supported, deployment
documentation, and this inventory in the same change.
