# Calendar sunset before the Phase 2C redeploy

Base: GitLab `origin/main`, `e23ffc6d18c1cb6c06bbd76ae1c2913a1b0e777c`.

This change completes the top-level Phase 2C URLs and retires Calendar from
navigation, Today, new-connection UI, and coaching context. Existing
`/app/calendar` links remain authenticated and show a retirement notice.
`/api/calendar/connect` and `/api/calendar/upcoming` return authenticated
`410 calendar_retired` responses. Authenticated OAuth callbacks started before retirement return to the notice
without exchanging or storing an authorization code. Anonymous callbacks retain
the existing 401 response; the Clerk/authentication boundary is unchanged.

Connection status and user-initiated disconnect remain available. Disconnect
still attempts Google revocation and deletes that user's saved token even if
Google fails. UI copy distinguishes local removal from attempted revocation.
Account export/deletion, Clerk, reminders, medications, payments, and other
coaching sources remain intact.

## Deferred until the connection audit is reviewed

No OAuth credentials, Google Cloud client, encryption key, or database records
are removed by this change. The Google client implementation is retained.
No bulk cleanup, migration, provider changes, or deployment occurs as part of
implementation. Retain `CALENDAR_TOKEN_ENCRYPTION_KEY` for revocation of stored
tokens. Old OAuth settings no longer gate startup.

The existing approved privacy PDF and historical audit/draft documents are
retained; the web privacy and AI copy now describe the retirement. Review the
published PDF alongside the final provider/data cleanup plan before release.

After explicit deployment authorization, verify the four canonical signed-in
URLs, Calendar notice and authenticated 410 responses, no Calendar requests
from Today or coaching, and existing disconnect behavior using an approved test
account. Provider-side revocation and production data cleanup require a separate
review after the connection inventory. A local commit or passing CI is not
production verification.

## Local validation

- `pnpm run typecheck:libs` builds declarations required in a fresh checkout.
- `pnpm --filter @workspace/kindred-coach run test`: 175 tests passed.
- `pnpm --filter @workspace/kindred-coach run typecheck`: passed.
- `LOG_LEVEL=silent pnpm --filter @workspace/db run test:api`: 276 tests passed
  using a disposable MongoDB replica set, including disconnect/revocation tests.
- `pnpm --filter @workspace/api-server run typecheck`: passed.
- Both canonical packages build; frontend prerender succeeds. A synthetic Clerk
  publishable key was also used to compile the signed-in bundle in isolation.
  This is build verification, not provider or production authentication proof.
- `git diff --check`: passed. Build tools report large-bundle warnings.

The fresh checkout initially lacked shared declaration files; building the
workspace libraries resolved that setup issue. The first disposable MongoDB
startup timed out; the subsequent complete API run passed after correcting a
new callback test to respect the existing authentication requirement.

No push, merge, deployment, production verification, or provider/data cleanup
was performed for this change. The approved privacy PDF still needs the review
noted above. Full workspace typecheck and live browser/provider checks were not
run; validation targets the canonical frontend and API.
