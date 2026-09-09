# Auth0 production cutover preparation

Prepared September 8, 2026 from GitLab `origin/main` at
`2205b982401cd809fd0a297eb9cd378e5e0c0159`, which includes Phase 2D.
This is a review package, not evidence of a completed cutover.

## Current release state

- Phase 2D MR !120 is merged. Its source pipeline passed all seven jobs.
- The preceding live Coolify inspection found the production application
  `kindred-asterling-ai-2026` running commit
  `9980553b0a316fe5dbe60f6daf5c421d8c5e217f`, deployment
  `9htx38z7sjmrv9xkjuxjljkv`. Both health endpoints returned success.
- Coolify points to GitLab `main`, commit `HEAD`; no deployment of the merge was
  queued or running. Merging and deploying are separate operations here.
- That inspection found no `AUTH0_*` or `VITE_AUTH0_*` hosting variables.
  Provider-side production URLs and customer migration are not verified.
- Re-read deployment history and GitLab main immediately before promotion.
  Do not deploy additional unreviewed commits that arrive after this preparation.

## Proposed configuration, awaiting production tenant selection

The existing locally tested tenant is `dev-rio3w0hvdl6hccn6.us.auth0.com` and
SPA client ID is `HhxYDycwHK6A71CofaymdURN9zEgvaFS`. These are public identifiers,
not secrets. The tenant name alone does not establish production readiness.
Confirm whether to use it or a separate production tenant before applying changes.
If selecting another tenant, replace both domain values and the client ID below,
and verify its API, connections, My Account grant, and refresh policy.

| Coolify variable | Proposed value for the existing tenant | Build | Runtime |
| --- | --- | --- | --- |
| `VITE_AUTH0_DOMAIN` | `dev-rio3w0hvdl6hccn6.us.auth0.com` | Yes | No |
| `VITE_AUTH0_CLIENT_ID` | `HhxYDycwHK6A71CofaymdURN9zEgvaFS` | Yes | No |
| `VITE_AUTH0_AUDIENCE` | `https://kindred-asterling-ai-coaching.com/api` | Yes | No |
| `AUTH0_DOMAIN` | `dev-rio3w0hvdl6hccn6.us.auth0.com` | No | Yes |
| `AUTH0_AUDIENCE` | `https://kindred-asterling-ai-coaching.com/api` | No | Yes |

Keep `APP_PUBLIC_URL=https://kindred-asterling-ai-coaching.com` and existing
database, AI, payments, reminder, medication, security and token-revocation
settings. Preserve Clerk credentials and mappings for rollback. Do not copy a
SPA client secret or management token into hosting or any `VITE_*` value.

In Auth0, select the approved SPA under Applications → Applications → Settings.
Review existing URL lists before editing; do not overwrite unrelated entries.
The application code uses the origin root as its callback and logout destination:

| Setting | Required production entry |
| --- | --- |
| Allowed Callback URLs | `https://kindred-asterling-ai-coaching.com/` |
| Allowed Logout URLs | `https://kindred-asterling-ai-coaching.com/` |
| Allowed Web Origins | `https://kindred-asterling-ai-coaching.com` |

Use exact URLs. Deep links such as `/today` return through application state;
they are not separate OAuth callbacks. Keep local development on a separate SPA
application before production promotion, rather than retaining localhost URLs
on the production client. Confirm production social connections use approved
production credentials; don't infer this from one successful local login.
These URL rules follow [Auth0 application settings](https://auth0.com/docs/get-started/applications/application-settings).

Verify RS256 and the exact API audience, refresh-token rotation, and the existing
My Account user grant/MRRT scopes documented in [auth0-migration.md](../auth0-migration.md).
Verify sender configuration, password reset, supported social providers, and MFA
with a designated test identity. Do not weaken security policies or create
duplicate grants to make a test pass.

## Prepared build changes

The root Dockerfile now accepts all three public Auth0 values through build
arguments or Coolify's existing Build Secrets mode. The deployment build rejects
missing/blank values before Vite runs. The build context excludes nested `.env*`
files so a developer's local tenant configuration cannot enter the image.
CI uses explicit synthetic identifiers; its artifacts are not production assets.

Prefer ordinary build arguments for these public values. If using secret mounts,
request a fresh uncached build when values change: secret contents do not affect
the build cache. Never change the global secret mode merely to pass these public
identifiers. See [Docker build secrets](https://docs.docker.com/build/building/secrets/)
and [cache invalidation](https://docs.docker.com/build/cache/invalidation/).

## Existing-account rehearsal: required before traffic switches

No customer inventory, export, import, or production mapping was performed by
this preparation. Use the existing migration command; do not link by email.

1. Authorize and take a consistent backup, then restore-test it in an isolated
   MongoDB replica set. Keep the report and customer data in private storage.
2. Inventory the existing Kindred IDs and Clerk subjects, authentication methods,
   paid/beta/owner accounts, social connections, and MFA status. Account for every
   affected user, including those without email. Record aggregate totals here,
   not personal records. A zero-user result must come from a verified inventory.
3. Approve a provider-specific import/re-enrollment plan. Verify ownership of each
   new Auth0 subject and prepare a private mapping of `userId`, `clerkUserId`,
   and `auth0UserId`. Do not guess that a password, Google login, or MFA factor
   transfers because a local sign-in succeeded.
4. Inject the isolated restore's URI/database into a trusted local terminal.
   From the repository root, run the default dry run:

   ```sh
   pnpm --filter @workspace/db exec tsx ./scripts/link-auth0-identities.ts --mapping /private/path/reviewed.json --database kindred_rehearsal
   ```

5. Review the mapping and dry-run results; then run the same command with
   `--apply` against that isolated restore. Rehearse database initialization to
   validate the unique partial `auth0UserId` index. Never point the disposable
   API test harness at production.
6. Verify unchanged internal user IDs, Clerk mappings, coaching history, journal,
   habits, medications, reminders, payment/customer references, and subscriptions.
   Confirm owner and beta access still resolve to the correct internal users;
   do not replace `SUBSCRIPTION_OWNER_IDS` with newly generated Auth0 subjects.
7. Reconcile all legacy accounts against the reviewed mapping. Require zero
   unexplained omissions/conflicts, or an explicitly approved staged plan with
   tested continued access for every unmigrated account. The current release has
   no dual-provider fallback; partial mapping alone is not a safe staged rollout.
8. Plan a bounded write freeze for final inventory/mapping and traffic switch so
   new Clerk signups cannot fall between inventory and cutover. Keep public
   marketing available and explicitly account for payment webhooks/reminder work
   during the freeze. Do not change ingress/provider settings as part of rehearsal.

The mapping command defaults to no writes, checks the target database name and
existing ownership, and applies updates transactionally. It preserves `users.id`
and `clerkUserId`. Production mapping needs explicit approval of the reviewed
mapping, target database, backup, reconciliation, and write-freeze procedure.

## Release acceptance and promotion sequence

| Gate | Evidence required | State at preparation |
| --- | --- | --- |
| Code | Frontend tests, workspace typecheck, API tests, build and whitespace checks | See validation below |
| Production tenant | Approved tenant/client, URLs, connections and grants read back after configuration | Pending |
| Customer continuity | Restore test, complete identity mapping and rehearsal, owner/beta/paid access | Pending |
| Authentication | Login → protected API → refresh → logout; session gone after logout | Local login/API previously passed; production and complete logout/account-security checks pending |
| My Account | Password reset/change, enrollment, step-up and factor removal with test identity | Pending |
| Phase 2D humans | 200% native zoom, screen reader, five representative testers | Zoom confirmed by user; screen reader and five testers pending |
| Container | Exact release image built using reviewed production public identifiers | Pending |
| Rollback | Retained old image/configuration and tested provider/data compatibility | Pending |

After these gates and the production mapping approval:

1. Read back the approved Auth0 settings and save the five Coolify variables.
   Preserve unrelated settings. Prevent an automatic deployment during preparation;
   verify current behavior rather than adding a duplicate webhook.
2. Record the final reviewed Git SHA, successful CI pipeline, immutable rollback
   image/digest, and a private copy of its runtime configuration. Merge the reviewed
   cutover preparation only when ready; recheck whether merge already queued a build.
3. Complete the approved write freeze, final identity reconciliation and production
   mapping. Do not run imports or migration commands from application startup.
4. Deploy the exact reviewed commit once through the existing Coolify resource.
   Ensure frontend and runtime use the same tenant/audience. Record deployment ID,
   Git SHA, image digest, start/end time and outcome from Coolify.
5. Verify both health endpoints, then the actual production browser flows below.
   The runtime requires Auth0 variables even though unauthenticated health routes
   themselves do not use Auth0. A build or health result cannot prove sign-in.
6. Remove the approved write freeze only after the initial continuity checks.
   Recheck webhook delivery and scheduled work; retain the old image and Clerk.

Production verification uses synthetic content and an approved mapped identity:

- `/today`, `/talk`, `/insights`, `/you` and legacy `/app/*` deep links, refresh,
  signed-out return destination, and rejected unauthenticated API requests.
- Morning check-in → scan → habit → evening progression and persisted history.
- Existing coaching history, one coaching/voice test, medication and reminder
  reads; any test delivery goes only to an explicitly approved test recipient.
- Correct owner/beta/paid entitlement and billing portal; use a separately approved
  payment test, never an unapproved real charge. Verify Helcim webhook delivery.
- Calendar remains absent from navigation/Today/new connections; retain existing
  disconnect/revocation. Do not revoke a real connection for a smoke test.
- Keyboard focus/navigation and 200% zoom; record the human screen-reader and
  P1–P5 results in [phase-2d-acceptance.md](phase-2d-acceptance.md).

## Rollback and retirement

Rollback triggers include startup failure, persistent auth errors, missing history,
incorrect entitlements, or payment/reminder regressions. Stop promotion and retain
diagnostics without tokens or customer content. Restore the preceding immutable
Coolify image and its matching Clerk runtime configuration; do not rebuild current
`main` and call it rollback. Verify health, Clerk sign-in, existing-account history,
entitlements, webhooks and reminders after restoration.

Do not automatically remove Auth0 mappings or restore the entire database: writes
after cutover would be lost. Legacy mappings allow previously linked users to
return to Clerk, but users created only in Auth0 after launch have no Clerk subject.
Before promotion, rehearse how those accounts retain access during rollback, or
approve a bounded signup freeze for the rollback window. A signup freeze is a
separate operational change, not implemented by this branch. Keep cross-provider
profile/password changes and paused/retried webhook deliveries in the rollback review.

Keep Clerk credentials, users, provider configuration, Google OAuth credentials,
Calendar records and token-revocation capability. No provider retirement, database
cleanup or credential rotation belongs in this release. Close the rollback window
only after production continuity and the remaining human checks are accepted.

## Validation of this preparation

Passed locally on Node 24.19.0 / pnpm 10.34.5:

- `pnpm --filter @workspace/kindred-coach run test`: 195 tests in 23 files,
  including six deployment-configuration checks.
- `pnpm run typecheck`: full workspace, including the production frontend/API,
  database scripts, libraries, scripts and experimental frontend.
- `pnpm --filter @workspace/db run test:api`: 298 tests in 37 files, using the
  disposable MongoDB replica-set harness. No production database was accessed.
- `pnpm --filter @workspace/kindred-coach run build:deployment`: Vite build and
  public prerender passed with synthetic public Auth0 identifiers.
- `pnpm --filter @workspace/api-server run build`: passed.
- `git diff --check`: passed.

Not performed: container build/boot (local Docker socket denied access), remote
CI for this preparation, production provider configuration, customer inventory or
restore rehearsal, identity import/mapping, live account-security tests, new human
acceptance sessions, deployment or production flow verification. The existing
migration tests use synthetic records; they do not prove customer migration.

No production settings, customer records, imports, messages, charges or deployments
were changed by preparation. No Clerk or Calendar credentials/data were removed.
