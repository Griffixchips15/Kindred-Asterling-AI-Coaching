import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? {
        rejectUnauthorized: true,
        ...(process.env.PG_SSL_CA ? { ca: process.env.PG_SSL_CA } : {}),
      }
    : undefined,
});
export const db = drizzle(pool, { schema });

export { dailyUsageTable } from "./schema";
export * from "./schema";
