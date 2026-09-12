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

import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createJobs,
  DEV_ENV_FILE,
  DEFAULT_DEV_DB_NAME,
  loadEnvFile,
  parseDevConfig,
  preflightPorts,
  runDevelopment,
} from "./dev-supervisor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFilePath = path.join(repoRoot, DEV_ENV_FILE);

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
  process.exit(1);
}

const { webPort, apiPort, dbMode } = config;

const occupied = await preflightPorts([
  { port: webPort, label: `KINDRED_WEB_PORT (frontend)` },
  { port: apiPort, label: `KINDRED_API_PORT (API)` },
]);
if (occupied.length > 0) {
  for (const entry of occupied) {
    console.error(
      `[dev] Port ${entry.port} (${entry.label}) is already in use.`,
    );
  }
  console.error(
    "[dev] Stopping; the conflicting process was left untouched. Change the port in .env.dev or stop the other process.",
  );
  process.exit(1);
}

// Provision the development database before the API starts.
let disposableDb = null;
async function provisionDatabase() {
  if (dbMode !== "disposable") return;
  if (config.apiEnv.MONGODB_URI) {
    console.error(
      "[dev] KINDRED_DEV_DB=disposable overrides MONGODB_URI/MONGODB_DATABASE for the API child; set KINDRED_DEV_DB=external to use your own development database.",
    );
  }
  try {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    const replicaSet = await MongoMemoryReplSet.create({
      binary: { version: "8.0.12" },
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    disposableDb = {
      replicaSet,
      stop: () => replicaSet.stop(),
    };
    config.apiEnv.MONGODB_URI = replicaSet.getUri();
    config.apiEnv.MONGODB_DATABASE = DEFAULT_DEV_DB_NAME;
    console.error(
      "[dev] Provisioned a disposable MongoDB replica set for development (data is lost when this command exits).",
    );
  } catch (err) {
    console.error(
      `[dev] Unable to provision the disposable development database: ${err?.message ?? err}`,
    );
    console.error(
      "[dev] Set KINDRED_DEV_DB=external and point MONGODB_URI at a dedicated development MongoDB (see docs/local-development.md).",
    );
    process.exit(1);
  }
}

await provisionDatabase();

let jobs;
const fixturePath = process.env.KINDRED_DEV_JOBS_FIXTURE;
if (fixturePath) {
  const fixture = await import(pathToFileURL(path.resolve(repoRoot, fixturePath)).href);
  jobs = fixture.buildJobs(config, { cwd: repoRoot });
} else {
  jobs = createJobs(config, { cwd: repoRoot });
}

console.error(
  `[dev] Starting frontend at http://localhost:${webPort} and API at ${config.apiOrigin} ...`,
);

const result = await runDevelopment(
  [jobs.build, jobs.web, jobs.api].filter(Boolean),
  { logger: console },
);

if (disposableDb) {
  try {
    await disposableDb.stop();
  } catch (err) {
    console.error(`[dev] Database cleanup failed: ${err?.message ?? err}`);
  }
}

if (result.code !== 0) {
  console.error(`[dev] Stopped with errors: ${result.reason}`);
}
process.exitCode = result.code ?? 1;