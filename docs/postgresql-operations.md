# Coolify/Contabo PostgreSQL operations

PostgreSQL is a persistent, first-class Coolify service. Never deploy it as an ephemeral application sidecar and never use `drizzle-kit push` in production.

## Roles and TLS

Create two non-login group roles and separate login credentials (replace placeholders):

```sql
CREATE ROLE kindred_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE kindred_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE kindred_app_login LOGIN PASSWORD '<from password manager>' IN ROLE kindred_app;
CREATE ROLE kindred_migrator_login LOGIN PASSWORD '<from password manager>' IN ROLE kindred_migrator;
ALTER ROLE kindred_migrator_login SET ROLE kindred_migrator;
GRANT CONNECT ON DATABASE kindred TO kindred_app, kindred_migrator;
GRANT USAGE ON SCHEMA public TO kindred_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kindred_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO kindred_app;
ALTER DEFAULT PRIVILEGES FOR ROLE kindred_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kindred_app;
ALTER DEFAULT PRIVILEGES FOR ROLE kindred_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO kindred_app;
GRANT ALL PRIVILEGES ON SCHEMA public TO kindred_migrator;
```

Set application `DATABASE_URL` to the app login and migration-job `MIGRATION_DATABASE_URL` to the migrator login. Do not grant `CREATE`, `ALTER`, `DROP`, superuser, or role-management privileges to the app role. Store both in Coolify secrets; the app startup script removes `MIGRATION_DATABASE_URL` before `exec`.

Require TLS (`sslmode=verify-full`) and use the database DNS name matching the certificate. For a private/self-signed CA, set `PG_SSL_CA` in both the app and migration job to the complete PEM CA certificate (including header/newlines); it is mandatory in that case. Rotate credentials and certificates through the password manager.

## Deploy migrations

Preferred: configure a one-shot Coolify deployment job using the new image and migrator secret:

```sh
NODE_ENV=production pnpm --filter @workspace/db run migrate
```

Run it after the backup/pre-deploy gate and before switching traffic to the new application version. The runner records checksums in `schema_migrations` and holds a PostgreSQL advisory lock, so only one migration process runs at once. A failed job blocks deployment. The container entrypoint also runs this command for deployments without a pre-deploy job; never run both deliberately.

## Scheduled encrypted backups and retention

Use a dedicated backup login with `CONNECT` plus read access only. In Coolify, schedule the PostgreSQL backup daily at **02:00 UTC**, encrypt it before it leaves the Contabo host, and upload to a private, versioned, off-host S3-compatible bucket. Use Coolify's encrypted backup integration when available; otherwise run:

```sh
set -eu
stamp=$(date -u +%Y%m%dT%H%M%SZ)
PGSSLMODE=verify-full PGSSLROOTCERT=/run/secrets/postgres-ca.pem \
  pg_dump --format=custom --no-owner --no-acl "$BACKUP_DATABASE_URL" \
  | age -r "$BACKUP_AGE_RECIPIENT" > "kindred-${stamp}.dump.age"
aws s3 cp "kindred-${stamp}.dump.age" "s3://$BACKUP_BUCKET/postgres/"
```

Keep encryption private keys outside Coolify/Contabo (password manager plus offline recovery copy), restrict bucket access to the backup service account, enable object lock/versioning, and alert on missing/zero-byte uploads. Retain **7 daily, 5 weekly, and 12 monthly** backups; lifecycle deletion occurs only after those windows. Take an additional encrypted backup immediately before every schema migration and retain it for 30 days. Review backup job logs every business day.

### Troubleshoot Coolify backup permission and role errors

These two messages are independent failures; fix both before treating the backup as
healthy:

```text
/data/coolify/backups/.../pg-dump-all-<timestamp>.gz: Permission denied
pg_dumpall: ... FATAL: role "<host-user>" does not exist
```

1. **Confirm which user and environment run the job.** Run the checks in the same
   context as the failing command (the Coolify terminal or backup container, not
   an unrelated root shell):

   ```sh
   id
   umask
   env | grep -E '^(PGHOST|PGPORT|PGDATABASE|PGUSER)=' | sed 's/=.*$/=<set>/'
   target=/data/coolify/backups/databases/<database-resource-id>
   namei -l "$target"
   test -d "$target" && test -w "$target" && echo writable
   ```

   Do not print `PGPASSWORD` or a connection URL into the job log.

2. **Repair the backup directory, not the whole `/data` tree.** Stop the schedule,
   create the exact resource directory if it is absent, and make it owned by the
   UID/GID reported by `id` in step 1. Run this on the Coolify host as an
   administrator, substituting the observed numeric IDs:

   ```sh
   install -d -o <backup-uid> -g <backup-gid> -m 0750 \
     /data/coolify/backups/databases/<database-resource-id>
   chown -R <backup-uid>:<backup-gid> \
     /data/coolify/backups/databases/<database-resource-id>
   find /data/coolify/backups/databases/<database-resource-id> \
     -type d -exec chmod 0750 {} +
   find /data/coolify/backups/databases/<database-resource-id> \
     -type f -exec chmod 0640 {} +
   ```

   If `namei` shows an unwritable parent or the filesystem is read-only/full, fix
   that mount first. Do not use `chmod -R 777`; it exposes database dumps and can
   hide an incorrect bind-mount or container UID.

3. **Set a real PostgreSQL login explicitly.** When `PGUSER`/`--username` is
   absent, PostgreSQL clients default to the operating-system user. A generated
   name such as `S3FilesRole_749189` therefore indicates that S3 credentials or a
   host identity were accidentally used as the database identity. In the Coolify
   database resource's backup settings, use the PostgreSQL resource's username,
   password, host, port, and database; use the S3 access key and secret only in
   the destination-storage fields. For a custom job, pass an explicit connection:

   ```sh
   export PGHOST='<postgres-service-host>'
   export PGPORT='5432'
   export PGDATABASE='kindred'
   export PGUSER='<postgres-backup-login>'
   export PGPASSFILE='/run/secrets/postgres-backup.pgpass'
   pg_dump --format=custom --no-owner --no-acl \
     --file=/tmp/kindred.dump "$PGDATABASE"
   ```

   Prefer `pg_dump` for this application's single database. `pg_dumpall` also
   dumps cluster-wide objects and normally needs broader privileges. If the
   Coolify built-in PostgreSQL backup intentionally uses `pg_dumpall`, select the
   PostgreSQL admin login created with that resource rather than the restricted
   application or S3 user.

4. **Verify database and object storage separately.** First produce a non-empty
   dump in the job's writable temporary directory, then use Coolify's **Validate
   Connection** action for the S3 destination. Check the bucket name, region,
   endpoint (including `https://` and any provider-required path-style setting),
   access key, secret, and permissions to put, list, get, and delete test objects.
   Only after both tests pass should the scheduled job stream/upload the dump.

5. **Prove the repaired backup.** Run one manual backup, confirm the job exits
   zero and the remote object is non-empty, download that exact object, and
   restore it into an isolated PostgreSQL instance. A successful S3 connection
   test alone does not prove that a database dump was created or is restorable.

After changing a PostgreSQL resource username or password, update the backup
configuration and restart/redeploy the resource as Coolify requires so the
scheduled job does not retain stale values. If a standard Coolify-generated job
still omits `PGUSER` or creates a root-owned resource directory, record the
Coolify version and the complete redacted job command and upgrade to the latest
supported patch before reporting the issue upstream.

## Restore procedure and quarterly drill

1. Declare an incident, stop application writes, record the desired recovery point, and preserve the failed database for forensics.
2. Provision a fresh isolated PostgreSQL service at the same major version, with storage capacity greater than the source. Configure TLS and roles above.
3. Download the chosen object, verify its object-store checksum, decrypt only on the restore host, and restore:

   ```sh
   age -d -i /run/secrets/backup-age-key.txt backup.dump.age > /tmp/backup.dump
   PGSSLMODE=verify-full PGSSLROOTCERT=/run/secrets/postgres-ca.pem \
     pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error \
     --dbname="$RESTORE_DATABASE_URL" /tmp/backup.dump
   rm -f /tmp/backup.dump
   ```

4. Run `pnpm --filter @workspace/db run migrate` with the restore service's migrator URL, then validate table counts, latest user/journal records, foreign keys, and a read-only application smoke test.
5. Rotate credentials, point the app at the restored service, monitor errors, then re-enable writes. Record actual recovery-point and recovery-time results.

Quarterly, restore the newest daily backup into an isolated disposable service and perform steps 3–4. The drill owner records backup timestamp, checksum, start/end time, RPO/RTO, row-count checks, smoke-test evidence, and remediation tickets. Delete the drill database and plaintext dump afterward. A backup is not considered healthy until a drill has successfully restored it.
