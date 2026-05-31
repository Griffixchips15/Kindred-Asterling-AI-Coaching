---
name: Publish DB migration for non-castable column changes
description: Why Replit publish fails on certain Drizzle schema changes (e.g. text→text[]) and the only safe way to resolve it.
---

# Publish DB migration: non-castable column type changes

When a Drizzle schema change alters a column to a type Postgres can't auto-cast
(classic case: `text` → `text[]`, error `column "..." cannot be cast automatically
to type ...`), Replit's publish-time auto-migration **fails validation**. The build
itself compiles fine — the failure is the database step, which happens before a new
build is even created, so the user just sees "Build failed."

## The fix (only supported path)
In the Publish UI's database step the user must select **"Copy your development
database schema & data to production"** (the overwrite option). The **default
selection is the OTHER radio — "Cancel deployment and retry…"** — and while that's
selected the action button literally says "Cancel deployment," so repeated attempts
keep cancelling. The user has to actively move the radio to the left/copy option.

**Why:** Postgres can't auto-cast existing non-array data, so the generated
`ALTER COLUMN ... SET DATA TYPE text[]` aborts. Overwriting prod with dev is the
sanctioned escape hatch (see database-migrations-on-publish reference).

**How to apply:**
1. The agent must NEVER run DDL/migrations against production (prod executeSql is
   read-only by design). Don't write migrate-prod scripts or deploy-time DDL hooks.
2. Before telling the user to pick "Copy to production," **mirror the real prod data
   into the dev DB first** (read prod read-only, INSERT into dev preserving ids/FKs,
   convert values to the new type), so the overwrite doesn't lose live data. Verify
   dev row counts match prod across all tables.
3. Then have the user pick the copy/overwrite radio so the blue dot moves off
   "Cancel," and the bottom button changes to a proceed action.

## Debugging a "Build failed" publish
- `getDeploymentInfo` / `listDeploymentBuilds`: if `hasSuccessfulBuild` is true and
  no NEW build appears after a retry, the failure is pre-build (DB step), not the app.
- The production bundle can be sanity-checked locally with the exact prod run command
  (`PORT=... NODE_ENV=production node --enable-source-maps <dist>/index.mjs`) then
  curl the health path — if it returns 200, the app/build is fine and the failure is
  the DB step or transient infra.
