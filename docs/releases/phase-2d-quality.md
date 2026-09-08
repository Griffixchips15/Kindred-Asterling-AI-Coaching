# Phase 2D quality and accessibility

Prepared September 8, 2026 on `codex/phase-2d-quality`, based on GitLab
`origin/main` commit `057a2050198d3f222c131647637b7ade97685c54`.

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
