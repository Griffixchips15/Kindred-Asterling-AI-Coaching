import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Stable, application-specific key. Session-level locks serialize all deploys.
const MIGRATION_LOCK_ID = 4_832_110_417;

function sslConfig(): pg.ConnectionConfig["ssl"] {
  if (process.env.NODE_ENV !== "production" && !process.env.PG_SSL_CA)
    return undefined;
  return {
    rejectUnauthorized: true,
    ...(process.env.PG_SSL_CA ? { ca: process.env.PG_SSL_CA } : {}),
  };
}

async function main(): Promise<void> {
  const connectionString =
    process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "MIGRATION_DATABASE_URL is not set (DATABASE_URL fallback is intended only for local development)",
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.MIGRATION_DATABASE_URL
  ) {
    throw new Error(
      "Production migrations require MIGRATION_DATABASE_URL for the dedicated migration role",
    );
  }

  const files = readdirSync(__dirname)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const client = new pg.Client({ connectionString, ssl: sslConfig() });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    for (const file of files) {
      const sql = readFileSync(path.join(__dirname, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE filename = $1",
        [file],
      );
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum)
          throw new Error(`Applied migration ${file} has been modified`);
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`Applying ${file} ...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
          [file, checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      console.log(`Applied ${file}`);
    }
  } finally {
    // Closing the connection releases the lock even if migration execution fails.
    await client.end();
  }
  console.log("All migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
