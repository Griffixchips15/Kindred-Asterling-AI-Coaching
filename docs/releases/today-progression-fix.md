# Today progression repair

Morning submitted an ISO timestamp while the Today API compared the stored value
with an exact YYYY-MM-DD string. A successful save therefore left Morning marked
incomplete. New morning saves now use the form's local date. Today accepts both
existing timestamp strings and date-only records within the requested day without
rewriting records. Its optional tzOffset query parameter aligns the day and body
scan boundaries with the browser and medication status; omitted offsets retain UTC.

Body scan saves and habit creation, completion, and removal now invalidate Today
queries, including queries with timezone parameters.

Validation on 2026-09-08:

- Frontend tests: 178 passed, including three real-query-cache navigation/save tests.
- API tests: 280 passed using the disposable MongoDB replica-set harness, including
  date-only and legacy timestamp morning saves, user isolation, positive/negative
  timezone offsets, and inclusive/exclusive scan boundaries.
- Shared-library, frontend, and API typechecks passed.
- git diff --check passed.
- Real signed-in localhost browser: saved a clearly labeled synthetic morning entry,
  returned through navigation, saw Morning complete and the next action advance to
  a body scan without a reload.
- Full workspace typecheck, builds, deployment, and production verification were not
  repeated for this fix. No provider settings or production records changed.

The interrupted preview process and its disposable database had already stopped
before restart. The restarted preview uses a fresh temporary database, containing
only the new local test entry and development account state.

Code generation encountered existing tooling mismatches: Orval imports a default
export absent from the overridden js-yaml 5 package, then emits Zod 4 APIs while
this workspace uses Zod 3. A local import compatibility shim allowed generation;
only the Today parameter/client additions were retained from that output, preserving
unrelated generated APIs and Zod 3 compatibility. Shared-library typecheck then
passed. The ordinary codegen command remains affected by those toolchain issues.
