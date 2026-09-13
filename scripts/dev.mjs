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
// (and its SIGINT/SIGTERM handlers) is created before any async work, and the
// disposable database is registered as a shutdown service before it is
// provisioned, so a stop request during an in-flight provisioning waits for it
// to settle and stops whatever resource appears late. Cleanup is bounded and
// idempotent for both process groups and services. Interruption at any point
// cancels further startup. There are no `process.exit()` calls: the process
// exits with the reported exit code after cleanup completes, and a shutdown
// whose cleanup could not be verified is reported as a failure.

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

// Load the replica-set factory that provisions the disposable development
// database. Production uses mongodb-memory-server's MongoMemoryReplSet.create;
// tests may inject a synthetic stand-in with KINDRED_DEV_DB_FACTORY (the module
// must export createReplicaSet(options) returning the same shape as
// MongoMemoryReplSet.create: a Promise of { getUri(), stop() }).
async function loadReplicaSetFactory() {
  const injected = process.env.KINDRED_DEV_DB_FACTORY;
  if (injected) {
    const mod = await import(
      pathToFileURL(path.resolve(repoRoot, injected)).href
    );
    if (typeof mod.createReplicaSet !== "function") {
      throw new Error(
        `KINDRED_DEV_DB_FACTORY module must export createReplicaSet() (${injected})`,
      );
    }
    return mod.createReplicaSet;
  }
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  return (options) => MongoMemoryReplSet.create(options);
}

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

  // Provisioning and shutdown share one lifecycle:
  //
  //   - The database is registered as a shutdown service BEFORE create()
  //     starts, so a signal during the (possibly long) download/start is still
  //     cleaned up on every exit path.
  //   - A stop request must never declare shutdown complete while a replica
  //     set that finished starting afterwards still exists, so the service's
  //     stop() waits for provisioning to settle and then stops whatever
  //     appeared. If provisioning failed or was interrupted, there is nothing
  //     to stop and stop() resolves.
  //   - create() is awaited with the stopReason checked right after it
  //     resolves, so a late-finishing replica set is stopped rather than
  //     started up, and no MONGODB_URI/startup follows an interruption.
  //   - forceStop() is the supported bounded fallback for a stop() that never
  //     settles: it releases owned resources synchronously when the factory
  //     provides one, otherwise it re-issues stop() best-effort and never
  //     blocks shutdown.
  const lifecycle = {
    replicaSet: null,
    settled: false,
    settledWaiters: [],
    markSettled() {
      this.settled = true;
      for (const waiter of this.settledWaiters) waiter();
      this.settledWaiters.length = 0;
    },
    whenSettled() {
      if (this.settled) return Promise.resolve();
      return new Promise((resolve) => this.settledWaiters.push(resolve));
    },
  };
  let stopOnce = null;
  coordinator.addService("database", {
    stop: () =>
      (stopOnce ??= (async () => {
        await lifecycle.whenSettled();
        if (lifecycle.replicaSet) await lifecycle.replicaSet.stop();
      })()),
    forceStop: () => {
      const rs = lifecycle.replicaSet;
      if (!rs) return;
      if (typeof rs.forceStop === "function") {
        try {
          rs.forceStop();
        } catch (err) {
          console.error(
            `[dev] failed to force-stop the disposable database: ${err?.message ?? err}`,
          );
        }
      } else {
        // mongodb-memory-server does not expose a hard kill; a second stop()
        // is its supported (idempotent) fallback and never blocks shutdown.
        void rs.stop().catch(() => {});
      }
    },
  });

  try {
    const createReplicaSet = await loadReplicaSetFactory();
    const replicaSet = await createReplicaSet({
      binary: { version: "8.0.12" },
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    lifecycle.replicaSet = replicaSet;
    if (coordinator.stopReason) {
      // A stop request arrived while the replica set was being created. The
      // shutdown service stops it; do not assign the URI or continue startup.
      console.error(
        "[dev] Interrupted while provisioning the disposable development database; stopping it.",
      );
      return { code: 0, reason: coordinator.stopReason };
    }
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
  } finally {
    // Release any stop() that is waiting on the in-flight provisioning so it
    // can dispose of whatever resource did (or did not) appear.
    lifecycle.markSettled();
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
  // An interruption anywhere (including one that wins the race only after
  // provisioning resolved, possibly with a late failure) stops here cleanly.
  if (coordinator.stopReason) return { code: 0, reason: coordinator.stopReason };
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
  // A shutdown whose cleanup could not be verified (a service stop failed or
  // never settled, and own resources had to be force-released) is a failure:
  // report it with a non-zero exit instead of a silent clean stop.
  if (outcome.code === 0 && coordinator.cleanupIncomplete()) {
    return { code: 1, reason: "shutdown could not verify complete cleanup" };
  }
  return outcome;
});

if (result.code !== 0) {
  console.error(`[dev] Stopped with errors: ${result.reason}`);
}
process.exitCode = result.code ?? 1;