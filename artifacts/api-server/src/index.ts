import app from "./app";
import { logger } from "./lib/logger";
import { startReminderScheduler } from "./lib/reminderScheduler";
import { stopReminderScheduler } from "./lib/reminderScheduler";
import { validateRuntimeConfig } from "./lib/validateConfig";
import { pool } from "@workspace/db";

validateRuntimeConfig();
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startReminderScheduler();
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");
  stopReminderScheduler();

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, 30_000);
  forceExit.unref();

  server.close(async (err) => {
    try {
      await pool.end();
      if (err) logger.error({ err }, "HTTP server close failed");
      else logger.info("HTTP server and PostgreSQL pool closed");
      process.exitCode = err ? 1 : 0;
    } catch (poolError) {
      logger.error({ err: poolError }, "PostgreSQL pool close failed");
      process.exitCode = 1;
    } finally {
      clearTimeout(forceExit);
    }
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
