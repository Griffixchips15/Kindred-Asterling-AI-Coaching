import { performance } from 'perf_hooks';
import pg from 'pg';

async function run() {
  const pool = new pg.Pool({
    connectionString: "postgresql://user:password@localhost:5432/db",
  });

  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error("DB not available, skipping test.", e.message);
    return;
  }
}

run();
