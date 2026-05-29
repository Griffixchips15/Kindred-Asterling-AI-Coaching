---
name: Journal write rollback pattern
description: How multi-step DB writes are made atomic and how their rollback is tested.
---
# Journal write rollback pattern

Every multi-step "save" in the API server is wrapped in a single `db.transaction`
inside a dedicated lib module (`medicationWrites.ts` for meds, `journalWrites.ts`
for habits/morning/scans/evening/profile), not inline in the route.

Each transaction ends with one mockable dependent step in its own module so tests
can force a mid-save failure and assert nothing persisted:
- meds: `medicationSchedule.reconcileScheduleEntries`
- journal: `writeContract.finalizeWrite` (serialize-only; no schema validation, to
  avoid changing client-facing response shapes).

**Why:** single throw anywhere in the tx callback rolls back the whole save, so a
future dependent write added inside a save stays all-or-nothing — and the
`*.test.ts` (vitest, real Postgres, `vi.mock` the seam to throw) guards against
regressions.

**How to apply:** add new dependent writes INSIDE the existing tx function; add a
"forced-seam-failure → no rows persisted" test alongside the happy path.
