# Production deployment on Coolify

The repository-root `Dockerfile` is the **only supported production deployment
artifact**. Do not use Nixpacks, Docker Compose generated from this repository,
PM2, Replit workflows, or a host-side Node process. Coolify builds the Dockerfile,
runs one non-root application container, and connects it to separately managed
MongoDB and AWS Bedrock.

## GitLab application setup (the new-resource screen)

For the Coolify screen shown when adding a **Private GitLab App** repository:

1. Select `kindred-asterling-ai-group/Kindred-Asterling-AI-Coaching`, then click **Load repository**. Loading
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
   secrets such as `MONGODB_URI`, `CLERK_SECRET_KEY`, and webhook secrets must
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
- A synthetic test coaching message receives a response from the configured AI
  provider. Do not use real health information for deployment smoke testing.
- Clerk, Helcim (when enabled), and Google Calendar (when enabled) report a 2xx
  response from their production webhook or callback URLs.
- A push to `main` starts a new Coolify deployment if automatic deployments are
  enabled; otherwise, a manual **Redeploy** builds the latest Git commit.
  If `/api/healthz` fails, inspect the application build and runtime logs first. If
  only `/api/healthz/db` fails, check `MONGODB_URI`, `MONGODB_DATABASE`, Coolify
  private-network DNS, and MongoDB's network allowlist. Do not repeatedly redeploy
  an unchanged image to fix a database connectivity or index problem.

## 1. Resources and build

1. Provision a MongoDB Atlas cluster or replica set and retain its private
   application connection URL. Standalone MongoDB is unsupported because
   Kindred's multi-document writes require transactions.
2. Configure AWS Bedrock for production as described in
   [aws-bedrock-coolify.md](aws-bedrock-coolify.md). Private Ollama is only a
   temporary, approved rollback option, not the production provider.
3. Create an application from this Git repository. Select **Dockerfile** with
   path `/Dockerfile`, port `8080`, and the production branch.
4. Add `VITE_CLERK_PUBLISHABLE_KEY` as a **build argument**. It is public and
   compiled into browser assets. A change requires a rebuild.
5. Add the applicable runtime values from `.env.example`. Do not add
   `POSTGRES_SOURCE_URL`, `PG_SSL_CA`, migration target variables, or
   migration reports to the application runtime. Mark keys, webhook signing
   secrets, database URLs, and encryption values as secrets.
   The Clerk publishable key is needed twice: the Vite build argument and
   `CLERK_PUBLISHABLE_KEY` at server runtime.
6. For a new empty MongoDB database, run
   `pnpm --filter @workspace/db run initialize` from a trusted environment before
   switching traffic. For the PostgreSQL cutover, follow
   [mongodb-migration.md](mongodb-migration.md) exactly. Migration is deliberately
   not part of container startup, so a restart cannot copy or delete data.

The image installs exactly once with `pnpm install --frozen-lockfile`, builds only
the web client and API, and packages the API's production dependency closure.
The final image contains compiled output, browser assets, and production
`node_modules`; it runs as the unprivileged `kindred` user.

## 2. Health checks

Configure the two core Coolify checks:

- **Application liveness:** `GET /api/healthz` expects HTTP 200. The Docker image
  also defines this check. It proves Express can accept requests without making
  deployment availability depend on MongoDB.
- **Database readiness:** `GET /api/healthz/db` expects HTTP 200. A database
  failure returns 503. Use it for alerts/readiness verification, not an aggressive
  restart loop, because restarting the application cannot repair MongoDB.

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

- MongoDB data on an Atlas cluster or a dedicated replica-set volume.

Enable scheduled, encrypted MongoDB backups to storage outside the Coolify
host. Retain **7 daily and 5 weekly restore points only**; all production backups
must expire within 35 days. Monitor failures, and perform a
quarterly restore drill into an isolated database. Snapshotting a volume alone is
not a substitute for a MongoDB-consistent backup. Back up Coolify configuration
and record the deployed Git SHA/image digest.

## 6. Deploy and rollback

Before promotion, GitLab CI validates the Node 24/pnpm 10.28.1 monorepo. Coolify
separately builds the root `/Dockerfile` from GitLab `main`. Build the exact
commit, complete the backup and MongoDB migration gate, and
deploy. Verify both health endpoints, Clerk login, one response from the configured
Bedrock provider using synthetic test data, and webhook delivery. Private Ollama
may be used only under the approved rollback procedure.

For application rollback, select the preceding successful Coolify deployment (or
its immutable image digest) and redeploy it, then verify both health checks. Do not
reverse a database migration automatically. If a release made an incompatible
schema change, follow its reviewed down-migration or restore the pre-deploy backup
only after stopping writes and accepting the documented data-loss window. Keep at
least two known-good application images and their configuration available.

On replacement, Coolify sends `SIGTERM`; the API stops its scheduler, drains the
HTTP listener, and closes the MongoDB pool. Allow at least 30 seconds before a
forced kill.
