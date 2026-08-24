import pg from 'pg';

async function run() {
  const pool = new pg.Pool({
    connectionString: "postgresql://user:password@localhost:5432/db",
  });

  try {
    await pool.query('SELECT 1');
    console.log("DB connected!");
  } catch (e) {
    console.error("DB not available:", e.message);
  }
}

run();
