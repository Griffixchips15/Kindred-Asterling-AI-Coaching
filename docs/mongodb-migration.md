# PostgreSQL to MongoDB migration

MongoDB is Kindred's runtime database. PostgreSQL is used only as the read-only
source for the one-time migration and remains untouched until the cutover has
been proven and its rollback window has closed.

## Safety gates

- Use a MongoDB replica set or Atlas cluster. Kindred relies on transactions for
  multi-document writes and account deletion.
- Take and restore-test a PostgreSQL backup before the final migration.
- Give `POSTGRES_SOURCE_URL` a read-only login. Never add it to the application
  container or Coolify runtime variables.
- Give the API MongoDB `readWrite` only on `MONGODB_DATABASE`. Use a separate
  credential with MongoDB's `read` role for reporting or manual inspection.
- Use a new, empty `MONGODB_MIGRATION_DATABASE` for every rehearsal and final
  run. The migration refuses a non-empty target and does not drop databases.

## Rehearsal

From a trusted migration environment containing this repository:

```bash
export POSTGRES_SOURCE_URL='postgresql://read-only-source/...'
export MONGODB_URI='mongodb+srv://migration-writer/...'
export MONGODB_DATABASE='kindred-current-runtime'
export MONGODB_MIGRATION_DATABASE='kindred_migration_rehearsal_YYYYMMDD'
export MONGODB_MIGRATION_REPORT_PATH='./mongodb-migration-rehearsal.json'
pnpm --filter @workspace/db run migrate:from-postgres
```

The exporter opens one PostgreSQL `REPEATABLE READ READ ONLY` transaction,
discovers every public base table, streams every row in bounded batches, and
copies each table to a same-named MongoDB collection. It preserves existing
primary keys as `_id`, including composite keys, and copies legacy/audit tables
even when the current API does not read them.

The command succeeds only after all of these checks pass:

- source and target row counts match for every table;
- an order-independent SHA-256 digest matches for every table;
- user, conversation, habit, medication, and administrative references have no
  orphans;
- every runtime unique/index constraint can be created; and
- integer ID counters are advanced to the migrated maxima.

The JSON report is created with owner-only permissions. Retain it with the
backup/cutover record, but do not commit it because table names and counts are
operational metadata.

## Final cutover

1. Schedule a maintenance window and stop Kindred application writes.
2. Confirm the PostgreSQL backup and rehearsal restore are usable.
3. Run the exporter again into a brand-new empty final MongoDB database. Do not
   reuse the rehearsal database.
4. Review the generated report and require every table to show identical source
   and target digests.
5. Set the application secrets to `MONGODB_URI` and the validated final
   `MONGODB_DATABASE`. Remove PostgreSQL variables from the application runtime.
6. Deploy the MongoDB application build, then verify `/api/healthz`,
   `/api/healthz/db`, sign-in, coaching chat, journaling, medications, reminders,
   calendar connection, subscription status/checkout, webhook processing,
   account export, and account deletion using synthetic accounts.
7. Monitor errors and reminder/webhook delivery through the agreed observation
   window before reopening normal traffic.

## Rollback and PostgreSQL retirement

Rollback is a deployment operation: stop writes, redeploy the pre-MongoDB
release, restore its PostgreSQL runtime secret, and verify the same signed-in
flows. PostgreSQL must therefore remain private, backed up, and unchanged during
the rollback window. Writes accepted only by MongoDB after cutover require an
explicit reverse-migration decision before rolling back.

Do not delete the PostgreSQL resource, revoke its backup access, or remove its
restorable backups until the Founder approves retirement after production proof.
Retirement is intentionally not automated by this repository.
