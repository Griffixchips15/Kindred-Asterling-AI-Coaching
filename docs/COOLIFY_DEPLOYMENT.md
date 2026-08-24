# Production deployment on Coolify

The repository-root `Dockerfile` is the **only supported production deployment
artifact**. Do not use Nixpacks, Docker Compose generated from this repository,
PM2, Replit workflows, or a host-side Node process. Coolify builds the Dockerfile,
runs one non-root application container, and connects it to separately managed
PostgreSQL and Ollama services.

## GitLab application setup (the new-resource screen)

For the Coolify screen shown when adding a **Private GitLab App** repository:

1. Select `Kindred_Asterling/kindred-ai`, then click **Load repository**. Loading
   the repository lets Coolify validate the branch and discover the root
   `Dockerfile`.
2. Set **Branch** to `main`, **Build pack** to `Dockerfile`, and **Base
   directory** to `/`. The slash means the Git repository root; it is not a path
   on the Coolify server.
3. Click **Continue**. On the application configuration page, set the Dockerfile
   location to `/Dockerfile`, the exposed/redirect port to `8080`, and add the
   application's public HTTPS domain.
4. In **Environment Variables**, add the values described below. Any `VITE_*`
   value used by the browser must have **Build Variable** enabled. Runtime-only
   secrets such as `DATABASE_URL`, `CLERK_SECRET_KEY`, and webhook secrets must
   not be exposed as build variables.
5. Save, deploy, and watch the build logs. A successful deployment should pass
   `GET /api/healthz`; verify `GET /api/healthz/db` separately after the database
   has been initialized.

Do not select the GitLab CI build pack or add a `.gitlab-ci.yml` merely to deploy
through Coolify. The GitLab App grants Coolify repository access and enables
deployments/webhooks, while the repository's root `Dockerfile` remains the build
definition. If `main` does not appear after **Load repository**, confirm that the
GitLab App has access to this project, refresh the repository list, and verify
that `main` has been pushed to GitLab.

### Confirm the Coolify configuration

If the repository, Dockerfile, variables, database, domain, and SSL are already
configured, deploy the application once and use this launch checklist. Replace
`https://kindred.example.com` with the domain configured in Coolify.

```bash
curl --fail --show-error https://kindred.example.com/api/healthz
curl --fail --show-error https://kindred.example.com/api/healthz/db
```

Both commands must exit successfully. Then confirm all of the following in a
browser or the relevant provider dashboard:

- The home page loads over HTTPS without a certificate warning.
- Clerk sign-in and sign-out work with the production Clerk instance.
- A test coaching message receives a response from the configured AI provider.
- Clerk, Helcim (when enabled), and Google Calendar (when enabled) report a 2xx
  response from their production webhook or callback URLs.
- A push to `main` starts a new Coolify deployment if automatic deployments are
  enabled; otherwise, a manual **Redeploy** builds the latest Git commit.

If `/api/healthz` fails, inspect the application build and runtime logs first. If
only `/api/healthz/db` fails, check `DATABASE_URL`, Coolify private-network DNS,
and whether the production schema was initialized. Do not repeatedly redeploy an
unchanged image to fix a database connectivity or schema problem.

## 1. Resources and build

1. Create a Coolify **PostgreSQL** resource and retain its internal connection
   URL. Keep PostgreSQL private; do not publish port 5432.
2. Create an Ollama service reachable on Coolify's private network, and persist
   `/root/.ollama` so models survive replacement.
3. Create an application from this Git repository. Select **Dockerfile** with
   path `/Dockerfile`, port `8080`, and the production branch.
4. Add `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_SENTRY_DSN` as **build
   arguments**. They are public and compiled into browser assets. Also set
   `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` (normally the Git SHA), and
   `VITE_SENTRY_TRACES_SAMPLE_RATE`. A change requires a rebuild.
5. Add the non-`VITE_*` values from `.env.example` as runtime environment
   variables. Mark keys, webhook signing secrets, database URLs, and encryption
   values as secrets. The Clerk publishable key is needed twice: the Vite build
   argument and `CLERK_PUBLISHABLE_KEY` at server runtime.
6. Initialize or upgrade the database from a trusted CI/admin environment before
   switching traffic:
   - **Brand-new, empty PostgreSQL resource:** run
     `pnpm --filter @workspace/db initialize`. This creates the complete baseline
     schema represented by the current Drizzle definitions. Do not run the
     incremental migrations first: they transform tables from older releases and
     assume those legacy tables already exist.
   - **Existing database from an older release:** back it up, run
     `pnpm --filter @workspace/db migrate` first to preserve and transform legacy
     data, and then run `pnpm --filter @workspace/db push` to reconcile the rest
     of the schema. Review the generated changes before accepting them in
     production.

   Schema initialization and migration are deliberately not part of container
   startup, so a restart cannot unexpectedly mutate production data.

### Sentry

Create separate Sentry projects for the browser and Node API. Configure the
browser project's DSN through the `VITE_SENTRY_DSN` build argument and the API
project's DSN through the runtime-only `SENTRY_DSN`. Use the same Git SHA for
`VITE_SENTRY_RELEASE` and `SENTRY_RELEASE` so events map to one deployment.

Leave either DSN blank to disable that SDK without affecting app startup. The
default trace sample rate is 10%; tune it for traffic and budget. Configure
source-map upload in Sentry's deployment integration rather than exposing an
organization auth token to the application image build.
Session Replay is intentionally not enabled because coaching screens can contain
sensitive journal and health information.

Browser `console.log`, `console.warn`, and `console.error` calls are forwarded as
Sentry logs. Prefer the structured logger for new instrumentation so fields can
be searched without parsing prose:

```ts
import * as Sentry from "@sentry/react";

// Good: a stable message plus low-cardinality, non-sensitive attributes.
Sentry.logger.info("Dashboard section opened", {
  section: "habits",
  source: "navigation",
});

// Good: interpolate values with Sentry's template helper to preserve grouping.
Sentry.logger.warn(Sentry.logger.fmt`API request retried after ${delayMs}ms`, {
  route: "/api/habits",
  attempt,
});

// Unexpected exceptions remain errors rather than being converted to strings.
Sentry.captureException(error, {
  tags: { operation: "load-habits" },
});
```

Do not log journal or chat text, health or medication details, names, email
addresses, Clerk identifiers, cookies, authorization headers, or request/response
bodies. Use stable route templates rather than full URLs, and use `debug`/`info`
for expected lifecycle events, `warn` for recoverable degradation, and `error`
or `captureException` only for unexpected failures. Console forwarding exists
for compatibility; avoid logging the same event through both `console` and
`Sentry.logger`, which would create duplicates.

The image installs exactly once with `pnpm install --frozen-lockfile`, builds only
the web client and API, and packages the API's production dependency closure.
The final image contains compiled output, browser assets, and production
`node_modules`; it runs as the unprivileged `kindred` user.

## 2. Health checks

Configure two Coolify checks:

- **Application liveness:** `GET /api/healthz` expects HTTP 200. The Docker image
  also defines this check. It proves Express can accept requests without making
  deployment availability depend on PostgreSQL.
- **Database readiness:** `GET /api/healthz/db` expects HTTP 200. A database
  failure returns 503. Use it for alerts/readiness verification, not an aggressive
  restart loop, because restarting the application cannot repair PostgreSQL.

## 3. Domain, Cloudflare, and TLS

- Point the public hostname at the Coolify proxy. In Cloudflare DNS, enable the
  orange-cloud proxy only after direct origin routing and certificate issuance
  work. Keep the application and database origin addresses private where possible.
- Set Cloudflare SSL/TLS mode to **Full (strict)**. Never use Flexible mode.
  Coolify must serve a valid origin certificate (Let's Encrypt or Cloudflare
  Origin CA) and redirect HTTP to HTTPS.
- Enable WebSockets and do not cache `/api/*`. Standard Cloudflare proxying is
  suitable; avoid transformations that alter webhook request bodies.
- Express defaults to `TRUST_PROXY_HOPS=1`, appropriate when exactly the Coolify
  reverse proxy is the direct peer. Cloudflare still supplies the client chain to
  that proxy. If another trusted proxy is inserted, set the exact hop count.
  Never use an unrestricted `trust proxy=true`: rate limits and secure request
  handling rely on an accurate client IP and protocol.
- Set `APP_PUBLIC_URL` to the canonical HTTPS origin, with no trailing slash.

## 4. Webhooks and OAuth

Register public HTTPS endpoints using the canonical hostname:

- Clerk webhook: `https://<host>/api/clerk/webhook`
- Helcim webhook: inspect the API route registered by the deployed release and
  use `https://<host>/api/payment/webhook`; preserve the raw request body.
- Google Calendar callback: `https://<host>/api/calendar/callback`

Store the corresponding Clerk and Helcim signing secrets in Coolify. Do not put
secrets in `VITE_*` variables. Confirm each provider's delivery log returns a 2xx
response after deployment and again after changing a domain.

## 5. Persistence and backups

The application container is stateless and needs **no persistent volume**. Do not
mount over `/app`; releases and rollback depend on immutable image contents.
Persist only service data:

- PostgreSQL data directory on a dedicated Coolify volume.
- Ollama model directory (`/root/.ollama`) on its own volume.

Enable scheduled, encrypted PostgreSQL backups to storage outside the Coolify
host. Retain daily and weekly restore points, monitor failures, and perform a
quarterly restore drill into an isolated database. Snapshotting a volume alone is
not a substitute for a PostgreSQL-consistent backup. Back up Coolify configuration
and record the deployed Git SHA/image digest; Ollama models may be re-pulled, but
pinning the model and retaining its volume makes rollback predictable.

## 6. Deploy and rollback

Before promotion, build the exact commit, run tests, back up PostgreSQL, and apply
backward-compatible migrations. Deploy, then verify both health endpoints, Clerk
login, one Ollama response, and webhook delivery.

For application rollback, select the preceding successful Coolify deployment (or
its immutable image digest) and redeploy it, then verify both health checks. Do not
reverse a database migration automatically. If a release made an incompatible
schema change, follow its reviewed down-migration or restore the pre-deploy backup
only after stopping writes and accepting the documented data-loss window. Keep at
least two known-good application images and their configuration available.

On replacement, Coolify sends `SIGTERM`; the API stops its scheduler, drains the
HTTP listener, and closes the PostgreSQL pool. Allow at least 30 seconds before a
forced kill.
