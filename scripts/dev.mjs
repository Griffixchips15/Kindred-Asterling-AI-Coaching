#!/usr/bin/env node
// Root `pnpm dev` launcher for the Kindred product (Phase 3A).
//
// Starts the production React/Vite frontend (artifacts/kindred-coach) and the
// Express API (artifacts/api-server) together, after documented first-time
// configuration (.env.dev). The Next.js experiment is intentionally NOT part
// of this command; run `pnpm dev:experiment` for that.
//
// Configuration precedence: inherited process environment > root `.env.dev` >
// built-in defaults.
//
// Signal coverage spans the entire startup lifecycle. The shutdown coordinator
// (and its SIGINT/SIGTERM handlers) is created before any async work, the
// disposable database is registered as a shutdown service before it is
// provisioned, and cleanup is bounded and idempotent. Interruption at any
// point cancels further startup. There are no `process.exit()` calls: the
// process exits with the reported exit code after cleanup completes.

import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createJobs,
  createShutdownCoordinator,
  DEV_ENV_FILE,
  DEFAULT_DEV_DB_NAME,
  loadEnvFile,
  parseDevConfig,
  preflightPorts,
  runDevelopment,
} from "./dev-supervisor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFilePath = path.join(repoRoot, DEV_ENV_FILE);

const envNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

// The coordinator owns process-group tracking, shutdown services and the
// SIGINT/SIGTERM handlers. It must exist before config parsing and database
// provisioning so an interruption during any startup phase is handled and
// cancels further startup. Grace windows are env-tunable for fast tests.
const coordinator = createShutdownCoordinator({
  logger: console,
  graceMs: envNumber("KINDRED_DEV_GRACE_MS", 8000),
  forceGraceMs: envNumber("KINDRED_DEV_FORCE_GRACE_MS", 4000),
  gracefulPollMs: envNumber("KINDRED_DEV_GRACEFUL_POLL_MS", 100),
});

const interrupted = () => Boolean(coordinator.stopReason);

async function provisionDatabase(config) {
  const fixturePath = process.env.KINDRED_DEV_DB_FIXTURE;
  if (fixturePath) {
    // Test-only stand-in for disposable database provisioning. May register
    // shutdown services on the coordinator and throw on configured failures.
    const fixture = await import(
      pathToFileURL(path.resolve(repoRoot, fixturePath)).href
    );
    return fixture.provisionDatabase(config, { coordinator, repoRoot });
  }

  if (config.dbMode !== "disposable") return { code: 0, reason: null };
  if (config.apiEnv.MONGODB_URI) {
    console.error(
      "[dev] KINDRED_DEV_DB=disposable overrides MONGODB_URI/MONGODB_DATABASE for the API child; set KINDRED_DEV_DB=external to use your own development database.",
    );
  }

  // Register the database as a shutdown service BEFORE provisioning starts so
  // a signal during the (possibly long) download/start is still cleaned up on
  // every exit path. `stopFn` is filled in once the replica set exists.
  let stopFn = null;
  coordinator.addService("database", {
    stop: () => (stopFn ? stopFn() : Promise.resolve()),
  });

  try {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    const replicaSet = await MongoMemoryReplSet.create({
      binary: { version: "8.0.12" },
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    stopFn = () => replicaSet.stop();
    config.apiEnv.MONGODB_URI = replicaSet.getUri();
    config.apiEnv.MONGODB_DATABASE = DEFAULT_DEV_DB_NAME;
    console.error(
      "[dev] Provisioned a disposable MongoDB replica set for development (data is lost when this command exits).",
    );
    return { code: 0, reason: null };
  } catch (err) {
    console.error(
      `[dev] Unable to provision the disposable development database: ${err?.message ?? err}`,
    );
    console.error(
      "[dev] Set KINDRED_DEV_DB=external and point MONGODB_URI at a dedicated development MongoDB (see docs/local-development.md).",
    );
    return { code: 1, reason: "database provisioning failed" };
  }
}

async function buildJobSet(config) {
  const fixturePath = process.env.KINDRED_DEV_JOBS_FIXTURE;
  if (fixturePath) {
    const fixture = await import(
      pathToFileURL(path.resolve(repoRoot, fixturePath)).href
    );
    return fixture.buildJobs(config, { cwd: repoRoot });
  }
  return createJobs(config, { cwd: repoRoot });
}

async function run() {
  let config;
  try {
    config = parseDevConfig({
      processEnv: process.env,
      fileEnv: loadEnvFile(envFilePath),
    });
  } catch (err) {
    console.error(`[dev] Invalid local development configuration: ${err.message}`);
    console.error(
      `[dev] Copy ${DEV_ENV_FILE}.example to ${DEV_ENV_FILE} and follow docs/local-development.md.`,
    );
    return { code: 1, reason: "invalid local development configuration" };
  }

  const { webPort, apiPort, apiOrigin } = config;

  const occupied = await preflightPorts([
    { port: webPort, label: "KINDRED_WEB_PORT (frontend)" },
    { port: apiPort, label: "KINDRED_API_PORT (API)" },
  ]);
  if (occupied.length > 0) {
    for (const entry of occupied) {
      console.error(`[dev] Port ${entry.port} (${entry.label}) is already in use.`);
    }
    console.error(
      "[dev] Stopping; the conflicting process was left untouched. Change the port in .env.dev or stop the other process.",
    );
    return { code: 1, reason: "ports in use" };
  }
  if (interrupted()) return { code: 0, reason: coordinator.stopReason };

  // Provision the development database before the API starts. If an
  // interruption arrives mid-provision, the coordinator stops registered
  // services and we exit cleanly without spawning anything.
  const provisioning = provisionDatabase(config).then(
    (outcome) => outcome ?? { code: 1, reason: "database provisioning failed" },
    (err) => {
      console.error(
        `[dev] Unable to provision the development database: ${err?.message ?? err}`,
      );
      return { code: 1, reason: "database provisioning failed" };
    },
  );
  const dbOutcome = await Promise.race([
    provisioning,
    coordinator.whenStopped().then(() => ({ interrupted: true })),
  ]);
  if (dbOutcome.interrupted) return { code: 0, reason: coordinator.stopReason };
  if (dbOutcome.code !== 0) return dbOutcome;

  const jobs = await buildJobSet(config);
  if (interrupted()) return { code: 0, reason: coordinator.stopReason };

  console.error(
    `[dev] Starting frontend at http://localhost:${webPort} and API at ${apiOrigin} ...`,
  );

  const result = await runDevelopment(
    [jobs.build, jobs.web, jobs.api].filter(Boolean),
    {
      logger: console,
      coordinator,
      buildFlushMs: envNumber("KINDRED_DEV_BUILD_FLUSH_MS", 5000),
      onReady: () => {
        console.error(
          `[dev] Both development servers are ready: frontend at http://localhost:${webPort}, API at ${apiOrigin} (health: ${apiOrigin}/api/healthz/db).`,
        );
      },
    },
  );
  return result;
}

const result = await run().then(async (outcome) => {
  // Bounded idempotent cleanup on every exit path (partial init, exceptions,
  // build failure, runtime exit, signal), then release the signal handlers.
  await coordinator.stopEverything();
  coordinator.dispose();
  return outcome;
});

if (result.code !== 0) {
  console.error(`[dev] Stopped with errors: ${result.reason}`);
}
process.exitCode = result.code ?? 1;