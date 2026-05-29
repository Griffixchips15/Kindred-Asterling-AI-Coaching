import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set; ensure the database is provisioned");
  }

  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No .sql migrations found.");
    return;
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(path.join(__dirname, file), "utf8");
      console.log(`Applying ${file} ...`);
      await client.query(sql);
      console.log(`Applied ${file}`);
    }
  } finally {
    await client.end();
  }
  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
