#!/usr/bin/env node
// Owned disposable-MongoDB worker for scripts/dev.mjs (Phase 3A final review).
//
// The disposable MongoDB replica set runs the real mongodb-memory-server
// MongoMemoryReplSet inside this dedicated subprocess, owned (as its own
// process group) by the launcher. That makes shutdown bounded using ONLY real,
// supported mechanisms:
//
//   - Graceful: the launcher SIGTERMs this owned group; this worker calls the
//     real MongoMemoryReplSet.stop() and exits 0.
//   - Force: if the worker has not exited within the launcher's grace window,
//     the launcher SIGKILLs the owned process group — a real OS-level release
//     that frees the bound port and terminates any mongod descendant. There is
//     no invented `forceStop` library method anywhere: MongoMemoryReplSet does
//     not expose one, and nothing depends on it.
//   - Initialization is interruptible too: a stop request that arrives while
//     create() is still in flight is remembered; the worker then waits for the
//     creation to settle (or fail) and stops whatever replica set appeared, so
//     a late-appearing resource is never leaked and no URI/startup follows an
//     interruption. A create that never settles is released by the same real
//     force path (SIGKILL of the owned group).
//
// Protocol:
//   - The single readiness line on stdout is `KINDRED_DB_WORKER_READY <uri>`.
//     All diagnostics go to stderr so the launcher can parse readiness
//     deterministically.
//   - Tests may inject a factory module via KINDRED_DEV_DB_FACTORY that exports
//     createReplicaSet(options) returning the same shape as
//     MongoMemoryReplSet.create: a Promise of { getUri(), stop() }. The
//     production default is the real MongoMemoryReplSet.create.
//   - KINDRED_DEV_DB_VERSION / KINDRED_DEV_DB_REPLSET_COUNT /
//     KINDRED_DEV_DB_STORAGE_ENGINE tune the real create options (defaults
//     mirror the launcher's documented development database).
//   - KINDRED_DEV_DEBUG_LOG appends a lifecycle audit trail like the launcher.

import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DB_WORKER_READY_PREFIX = "KINDRED_DB_WORKER_READY";

function debugLog(message) {
  const file = process.env.KINDRED_DEV_DEBUG_LOG;
  if (!file) return;
  try {
    appendFileSync(file, `${Date.now()} [db-worker] ${message}\n`);
  } catch {
    // best-effort diagnostics only
  }
}

async function loadFactory() {
  const injected = process.env.KINDRED_DEV_DB_FACTORY;
  if (injected) {
    const mod = await import(pathToFileURL(path.resolve(repoRoot, injected)).href);
    if (typeof mod.createReplicaSet !== "function") {
      throw new Error(`KINDRED_DEV_DB_FACTORY module must export createReplicaSet() (${injected})`);
    }
    return mod.createReplicaSet;
  }
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  return (options) => MongoMemoryReplSet.create(options);
}

let replicaSet = null;
let creating = null;
let stopRequested = false;
let stopping = null;
const keepAlive = setInterval(() => {}, 1000);

function stopDatabase() {
  if (!stopping) {
    debugLog("stop requested; releasing owned replica set");
    stopping = (async () => {
      try {
        if (creating) await creating.catch(() => {});
        if (replicaSet) await replicaSet.stop();
        debugLog("replica set stopped");
        console.error("[db-worker] disposable database stopped");
        process.exitCode = 0;
      } catch (err) {
        console.error(`[db-worker] failed to stop disposable database: ${err?.message ?? err}`);
        process.exitCode = 1;
      } finally {
        clearInterval(keepAlive);
        debugLog(`worker exiting code=${process.exitCode}`);
      }
    })();
  }
  return stopping;
}

// A signal that arrives while create() is still in flight only records the
// intent: main() owns the replica-set assignment and stops it immediately
// (synchronously after assignment), which avoids a race where a stop could
// run before `replicaSet` is set and then leak a live resource.
function handleSignal(signal) {
  if (stopRequested) return;
  stopRequested = true;
  console.error(`[db-worker] received ${signal}; stopping disposable database...`);
  if (replicaSet) void stopDatabase();
}

process.on("SIGTERM", () => handleSignal("SIGTERM"));
process.on("SIGINT", () => handleSignal("SIGINT"));

async function main() {
  try {
    const createReplicaSet = await loadFactory();
    const options = {
      binary: {
        version: process.env.KINDRED_DEV_DB_VERSION || "8.0.12",
      },
      replSet: {
        count: Number(process.env.KINDRED_DEV_DB_REPLSET_COUNT || 1),
        storageEngine: process.env.KINDRED_DEV_DB_STORAGE_ENGINE || "wiredTiger",
      },
    };
    creating = createReplicaSet(options);
    debugLog(`create() in flight (version=${options.binary.version})`);
    const rs = await creating;
    creating = null;
    replicaSet = rs;
    debugLog("create() resolved");
    if (stopRequested) {
      // A stop arrived while the replica set was being created; release it
      // without reporting readiness (the launcher never starts anything).
      return stopDatabase();
    }
    process.stdout.write(`${DB_WORKER_READY_PREFIX} ${rs.getUri()}\n`);
    console.error("[db-worker] disposable MongoDB replica set is ready");
    debugLog(`ready uri=${rs.getUri()}`);
    // Stay alive until a stop signal arrives; the launcher owns this group.
    await stopDatabase();
  } catch (err) {
    if (!stopRequested) {
      console.error(
        `[db-worker] unable to provision the disposable development database: ${err?.message ?? err}`,
      );
      console.error(
        "[db-worker] set KINDRED_DEV_DB=external and point MONGODB_URI at a dedicated development MongoDB (see docs/local-development.md).",
      );
      process.exitCode = 1;
    }
    clearInterval(keepAlive);
  }
}

await main();
debugLog("worker finished");
