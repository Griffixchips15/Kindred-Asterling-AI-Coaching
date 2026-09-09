# Phase 2D quality and accessibility

Prepared September 8, 2026 on `codex/phase-2d-quality`, based on GitLab
`origin/main` commit `057a2050198d3f222c131647637b7ade97685c54`.

## Current acceptance status

MR !118 was merged by the owner on September 8, 2026 at 08:47 MDT as
`f7ddedc8015f00bb0446f7bc734329d894181117`. The source pipeline #2829940216
and main pipeline #2830009230 passed. The owner confirmed successful local review
including native browser zoom at 200%. The historical sections below retain the
validation evidence from before the merge.

The follow-up acceptance review passed `pnpm run typecheck` (including DB scripts,
both production apps, workspace libraries/scripts and the experimental frontend)
and `pnpm --filter @workspace/api-server run build`. The merged main tree was
identical to the already-tested conflict-resolution tree.

GitLab's MR security report identified three test-fixture findings: a sample
password-bearing MongoDB URI in `validateConfig.test.ts` and non-cryptographic
random test IDs in `chatTools.test.ts` and `journalRoutes.http.test.ts`. The
follow-up replaces the URI with a credential-free loopback URI and uses UUIDs
for those two ID generators. These fixtures do not issue production credentials
or connect to the example database. No scan rules or GitLab finding statuses
were changed; a new pipeline is required to confirm the scanner outcome.

After the fixture edits, `pnpm --filter @workspace/api-server run typecheck`
passed, and `LOG_LEVEL=silent pnpm --filter @workspace/db run test:api` passed
all 292 tests in 36 files. `git diff --check` also passed. Frontend tests/build
and the full-stack journey were not repeated in this follow-up because no
frontend or runtime code changed; their combined-version results appear below.

Human screen-reader testing and the five-user pilot remain open. Hosted Auth0
sign-in and the browser daily loop were verified after the repairs below.
See [the acceptance checklist](phase-2d-acceptance.md).
No deployment or production verification is established by the merge or green CI.

## Auth0 acceptance repairs

Real browser acceptance on the combined version exposed two failures that the
original journey's already-signed-in mock did not exercise:

- When Auth0 finished loading, the identity-change effect cleared the query
  cache after the account query had started. This detached/cancelled the query
  and left the page on “Opening your account…”. Protected queries now wait for
  the identity's cache cleanup. The journey now starts with authentication
  loading and then signs in; it failed before this fix and passes after it.
- Every API data request fetched Auth0 UserInfo. Navigating through the dashboard
  caused confirmed HTTP 429 responses and account-loading errors. UserInfo claims
  now share concurrent lookups and are cached in memory for at most 60 seconds,
  bounded by JWT expiry and 1,000 entries. Cache keys are token hashes, not bearer
  tokens. Failed or mismatched responses are not cached. Every request still
  verifies its JWT and performs the application identity lookup/sync, so the
  cache contains no application authorization decisions. Profile updates can
  take up to 60 seconds to refresh.

Auth0 documents [caching UserInfo responses to reduce rate-limit failures](https://support.auth0.com/center/s/article/Error-code-429).
No authentication provider settings, credentials, or production records changed.

Validation of these repairs:

- Real Auth0 login return and fresh browser reload opened the protected app.
- In Chrome, synthetic morning, body scan, habit, and evening entries saved
  through the real API into a disposable local MongoDB database. Today advanced
  through the steps and ended at “You're on track”, with all four steps complete.
- Evening keyboard arrow selection and route-to-main focus were checked.
- `pnpm --filter @workspace/kindred-coach run test`: 189 tests passed.
- `pnpm --filter @workspace/db run test:journey`: the authentication-transition
  regression and full daily loop passed.
- `LOG_LEVEL=silent pnpm --filter @workspace/db run test:api`: 298 tests passed
  in 37 files, including cache expiry, concurrency, isolation, failure recovery,
  and per-request application identity checks.
- `pnpm run typecheck`: full workspace passed.
- Frontend build/prerender using synthetic Auth0 public configuration and
  `pnpm --filter @workspace/api-server run build`: passed.
- `git diff --check`: passed.

The earlier fixture-only commit `a87d4a6` passed GitLab pipeline #2831175695;
that result does not validate these later auth repairs. Their pipeline must be
checked separately. The human pilot and screen-reader session are not replaced
by this automated/browser evidence.

## Changes

- Add a keyboard skip link, route-change focus handoff, accessible collapsed
  navigation names, and predictable mobile menu focus restoration.
- Improve narrow-screen and short-viewport reflow, safe-area spacing, dialog
  scrolling, visible keyboard focus, and touch targets. Fix the clipped Today
  next-step button at 320px.
- Respect reduced motion in animation, chat scrolling, and affirmation autoplay;
  keep manual affirmation controls available.
- Connect daily-flow and medication form labels, expose slider names, and use
  keyboard-operable radio groups for evening mood and medication effectiveness.
- Add focused navigation/reduced-motion tests and a full-stack daily journey:
  morning check-in, medication dose, body scan, habit completion, evening review,
  and the resulting Today progression.

Canonical and legacy routes, Calendar disconnect/revocation, Clerk, reminders,
medications, payments, voice, and coaching remain in place. No provider settings,
credentials, production records, or container configuration were changed.

## Automated validation

The following records the original Phase 2D validation before the Auth0 merge
resolution described below.

| Command | Result |
| --- | --- |
| `pnpm --filter @workspace/kindred-coach run test` | 183 tests passed in 21 files |
| `pnpm --filter @workspace/kindred-coach run typecheck` | Passed |
| `pnpm --filter @workspace/db run typecheck:scripts` | Passed |
| `pnpm --filter @workspace/db run test:journey` | 1 full-stack journey passed |
| `LOG_LEVEL=silent pnpm --filter @workspace/db run test:api` | 280 tests passed in 34 files |
| `VITE_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZGV2JA== pnpm --filter @workspace/kindred-coach run build` | Build and 25-route prerender passed |
| `git diff --check` | Passed |

The journey mounts the production React app in jsdom and uses real Express HTTP
requests and a fresh disposable MongoDB replica set. Clerk uses the existing
test-only identity adapter. The runner excludes inherited provider credentials
and disables AI and payments. It does not test hosted Clerk or browser rendering.
jsdom emits chart geometry and React act warnings; assertions pass. The build
reports a large-chunk warning.

Full-workspace typecheck and API build were not run for this change; production
API code is unchanged.

## Browser validation and remaining acceptance

An isolated signed-in local preview at `http://localhost:8084/today` was checked
with a disposable database. It is separate from the existing port 8080 preview.
The disposable preview is not durable storage.

Verified in the browser:

- 320px reflow for Today, Talk, Insights, You, habits, body scans, and medications;
  no horizontal overflow on the checked pages and dialogs.
- Skip-link activation, mobile menu Escape/focus restoration, route focus
  handoff, form labels, accessible landmarks, and evening radio arrow selection.
- Reduced-motion behavior and 44px button targets on the checked surfaces.
- 200% CSS page scaling and the equivalent narrow CSS viewport, including the
  evening form and scrollable sidebar.

Still required for Phase 2D acceptance:

- Native browser 200% zoom testing (CSS scaling is not equivalent evidence).
- A human screen-reader session; accessibility-tree inspection alone is not one.
- Five representative users completing the daily flow without assistance or
  needing the full navigation, as specified by the original Phase 2D pilot gate.

These checks do not establish formal WCAG conformance. This handoff is local
implementation and validation only: no Phase 2D push, merge, deployment, or
production verification has been performed.

## MR !118 compatibility update

After the successful local review and Phase 2D branch push, GitLab `main` advanced
to `56e012ec91fc5de751a9cacdf1c5ba2f59b832b5`, containing the Auth0 migration.
Merging that revision into the Phase 2D source branch preserves its new auth
interface alongside the `useRef` import required for accessible focus handling.
The daily journey now mocks the application's auth interface rather than the
removed Clerk SDK; it still uses the existing test-only API identity adapter and
real HTTP and disposable MongoDB persistence. No provider settings were changed.

Repeated validation on the combined branch:

- `pnpm install --frozen-lockfile`: passed, using the upstream lockfile.
- `pnpm --filter @workspace/kindred-coach run typecheck`: passed.
- `pnpm --filter @workspace/kindred-coach run test`: 189 tests passed in 22 files.
- `pnpm --filter @workspace/db run test:journey`: 1 journey passed.
- `LOG_LEVEL=silent pnpm --filter @workspace/db run test:api`: 292 tests passed
  in 36 files.
- `VITE_AUTH0_DOMAIN=example.auth0.com VITE_AUTH0_CLIENT_ID=local-build-check VITE_AUTH0_AUDIENCE=https://api.example.test pnpm --filter @workspace/kindred-coach run build`:
  build and prerender passed with synthetic public configuration.
- `git diff --check` and `git diff --cached --check`: passed.

Full-workspace typecheck, DB script typecheck, API build, and browser/provider
sign-in testing were not repeated for this conflict resolution. The earlier
Clerk preview review does not verify the newly merged hosted Auth0 sign-in flow.
This update is for the Phase 2D source branch only; it does not merge MR !118 into
`main`, deploy, or verify production.
