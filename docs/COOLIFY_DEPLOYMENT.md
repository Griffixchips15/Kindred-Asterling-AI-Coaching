# Production deployment on Coolify

The repository-root `Dockerfile` is the **only supported production deployment
artifact**. Do not use Nixpacks, Docker Compose generated from this repository,
PM2, Replit workflows, or a host-side Node process. Coolify builds the Dockerfile,
runs one non-root application container, and connects it to separately managed
PostgreSQL and Ollama services.

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
browser project's DSN through the `VITE_SENTRY_*` build arguments and the API
project's DSN through the runtime-only `SENTRY_DSN`. Use the same Git SHA for
`VITE_SENTRY_RELEASE` and `SENTRY_RELEASE` so events map to one deployment.

Leave either DSN blank to disable that SDK without affecting app startup. The
default trace sample rate is 10%; tune it for traffic and budget. Configure
source-map upload in Sentry's deployment integration rather than exposing an
organization auth token to the application image build.
Session Replay is intentionally not enabled because coaching screens can contain
sensitive journal and health information.

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
