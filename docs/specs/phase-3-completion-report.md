# Phase 3 completion report

Branch: `codex/phase-3a-dev-workflow`
Final SHA: `FINAL_SHA`
Baseline (merge-base with `origin/main`): `2205b98`
Local worktree: `/tmp/kindred-phase-3a` (git worktree of the shared repository).

## Summary

Phases 3A–3D are implemented and locally verified. Everything is **locally
committed only**: nothing was pushed, merged, deployed, or production-verified
in this assignment. Real GitLab CI for the final SHA, live Auth0 acceptance, and
the Coolify production release remain **pending** external gates requiring an
authorized later handoff.

## Part SHAs

| Part | Commits | Contents |
| ---- | ------- | -------- |
| 3A groundwork + review | `84cae51` | root `pnpm dev` launcher (product UI + API + disposable MongoDB) |
| 3A | `ceebb23`, `983d90e` | supervise shutdown through startup, wait for descendants, truthful Auth0 fallback, late-provisioning cleanup and bounded service stops |
| 3B toolchain/regeneration | `7f5de78` | pin `orval` deps (js-yaml scope, zod v3 output), remove a stale nested orval@8.31.0 store, regenerate clients (only Calendar-410 additions) |
| 3B verify machinery | `12516b1` | `pnpm verify` orchestrator, prettier boundary, `generate:check` sandbox drift check, sanitized child env, `test:verify` |
| 3C | `6513a40` | `.gitlab-ci.yml` parity (the 9 verify components), `pnpm release:check` read-only gate + evidence stamp + tests |
| 3D | `25bcc12`, final commit | root README, release/rollback + tools inventory docs, experiment labeling, historical cutover labels |

## Decisions

- **No repo-wide reformat.** Only a maintained prettier boundary
  (`.prettierrc.json`/`.prettierignore`, auto-discovered `scripts/*`, configs,
  package.json) is enforced; legacy/generated files are untouched.
- **`generate:check` is a sandbox copy + real orval bin.** It reproduces the
  committed invocation inside a temp copy (node_modules symlinked) and
  byte-compares against tracked trees; it never mutates the working tree.
- **Sanitized child env, no synthetic values.** `pnpm verify` forwards only a
  whitelist; secrets, `VITE_*` build values and stale DB/Auth0 vars are never
  forwarded. Removing early synthetic Auth0 injection restored the frontend's
  committed `.env.local` fallback contract.
- **Codegen toolchain pinned.** `override.zod.version: 3` (avoid zod-v4 output
  against pinned zod 3.25.76) and a scoped `orval>js-yaml@4.3.0` override;
  the stale nested `lib/api-spec/node_modules/.pnpm` (orval 8.31.0) was removed
  so orval 8.23.0 (the lockfile pin) resolves everywhere.
- **CI = one job per verify component** with the same commands and pinned
  toolchain; workflow rules drop redundant feature-branch push pipelines while
  keeping MR, default-branch, tag and scheduled coverage. Security includes
  (SAST, dependency scanning, secret detection) are unchanged.
- **release:check is read-only.** Reports, never mutates, never calls a remote;
  unverified remote/production evidence is never marked passed. Missing remote
  access ⇒ unverified.
- **Docs update existing sources**; no new competing sources except the missing
  root README (entry point) and the required release/rollback + tools inventory.

## Exact command outcomes

| Command | Outcome |
| ------- | ------- |
| `pnpm verify` (9 components) | passed, all 9, at `12516b1` (see final commit note below) |
| `RUN_VERIFY_INTEGRATION=1 pnpm run test:verify` | 12/12 passed |
| `pnpm run test:release-check` | 9/9 passed |
| `pnpm run test:dev-supervisor` | passed (3A) |
| `pnpm run format:check` | exit 0 |
| codegen + `typecheck:libs` | exit 0, orval `v8.23.0`, no `Object.fromEntries`, diff vs HEAD = 27 insertions / 13 deletions (410 additions) |
| CI YAML parse (js-yaml) | OK; jobs == the 9 verify components |
| `pnpm run typecheck` (broader) | see final gate below |
| `pnpm run release:check` | recorded on the final SHA; see the accompanying chat result |

## Final gate (run on the final candidate)

Recorded after the final commit at the SHA stamped in this report:

- `pnpm verify` — all 9 components passed on the final SHA (evidence recorded
  in `.verify-evidence.json`, keyed to the final SHA + clean tree).
- `pnpm run typecheck` — broader workspace pass on the final SHA.
- `git diff --check` — clean on the working tree and on `origin/main..HEAD`.
- Working tree clean; no unrelated tracked/untracked changes; no background
  dev/test processes left running.
- `pnpm run release:check` — see the accompanying chat result (unverified
  remote/production fields expected: push/CI/merge/deploy/acceptance pending).

## Clean-checkout rehearsal

A fresh clone of the final branch into a temporary directory with
`pnpm install --frozen-lockfile` — see the accompanying chat result. If the
rehearsal install could not fully complete offline it is listed as an omitted
check below.

## Omitted checks / pending external gates

- Real GitLab pipeline for the final SHA — pending authorized push (external).
- Live Auth0 production sign-in acceptance — pending authorized handoff.
- Coolify release, deployed-revision evidence, and production acceptance —
  pending authorized handoff.
- No operational data commands were executed; provider settings untouched;
  no permissions/billing changes.

## Known limitations

- `generate:check`, `test:journey` and the full `verify` still need the local
  workspace install (orval bin, mongodb-memory-server binary) as documented.
- `release:check` legitimately reports local-only evidence; it cannot observe
  GitLab/Coolify/production state, so those fields stay `unverified` until an
  authorized push and handoff.
- `git diff --check` flags one generated-file EOF blank line
  (`api.schemas.ts`); it is the generator's canonical output and is deliberately
  not hand-edited (that would break `generate:check`).