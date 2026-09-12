// Local development process supervisor for the Kindred product.
//
// Phase 3A scope: root `pnpm dev` starts the production Vite frontend
// (`artifacts/kindred-coach`) and the Express API (`artifacts/api-server`)
// together, with coordinated shutdown and clear failure reporting. This module
// is deliberately small and dependency-free: it only uses Node 24 built-ins.
//
// Design rules implemented here:
//   - Each child runs the existing workspace package command (Vite/API) so the
//     real product is tested, never a stand-in.
//   - Every owned child is spawned detached (its own process group) so cleanup
//     signals reach pnpm wrappers and their descendants, without ever using
//     `pkill`/`killall` or port-based process killing.
//   - A build phase runs to completion first; a failure aborts startup.
//   - Port preflight is a courtesy check; the supervisor still reacts to an
//     actual bind failure that turns into a nonzero child exit.
//   - SIGINT/SIGTERM only affects children owned by this invocation.

import { spawn } from "node:child_process";
import net from "node:net";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

// When KINDRED_DEV_DEBUG_LOG is set, append an audit trail of child lifecycle
// events (spawn pid, exit, signals, cleanup) to that file. Off by default.
function debugLog(message) {
  const file = process.env.KINDRED_DEV_DEBUG_LOG;
  if (file) {
    try {
      appendFileSync(file, `${Date.now()} ${message}\n`);
    } catch {
      // best-effort diagnostics only
    }
  }
}

export const DEFAULT_WEB_PORT = 8080;
export const DEFAULT_API_PORT = 3000;
export const DEFAULT_DEV_DB_MODE = "disposable";
export const DEFAULT_DEV_DB_NAME = "kindred_dev";
export const DEV_ENV_FILE = ".env.dev";

// ---------------------------------------------------------------------------
// .env parsing (tiny, no dependency)
// ---------------------------------------------------------------------------

// Parse dotenv-style text: `KEY=VALUE` lines, `#` comments, optional
// `export ` prefix, optional single/double quotes around the value.
export function parseEnvFile(text) {
  const result = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const stripped = line.startsWith("export ")
      ? line.slice("export ".length).trimStart()
      : line;
    const eq = stripped.indexOf("=");
    if (eq <= 0) continue;
    const key = stripped.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = stripped.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return parseEnvFile(readFileSync(filePath, "utf8"));
}

// ---------------------------------------------------------------------------
// Port helpers
// ---------------------------------------------------------------------------

// Returns the numeric port or throws. Values are echoed in the error because
// ports are local, non-secret configuration and the message is actionable.
export function parsePort(value, name) {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(
      `${name} must be an integer between 1 and 65535 (received "${value}").`,
    );
  }
  return parsed;
}

// True if nothing is listening on host:port (we can bind it right now).
export function checkPortFree(port, host = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      // EADDRINUSE / EACCES mean the port is effectively taken.
      server.close();
      resolve(err?.code !== "EADDRINUSE" && err?.code !== "EACCES");
    });
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

// True if something is already listening on host:port.
export async function checkPortInUse(port, host = "0.0.0.0") {
  return !(await checkPortFree(port, host));
}

// Returns the occupied entries from `ports` ({ port, label })[].
export async function preflightPorts(ports) {
  const occupied = [];
  for (const entry of ports) {
    if (await checkPortInUse(entry.port)) occupied.push(entry);
  }
  return occupied;
}

// ---------------------------------------------------------------------------
// Development configuration
// ---------------------------------------------------------------------------

// Merge order: fileEnv provides the isolated development configuration, while
// the inherited process environment deliberately overrides it.
export function mergeDevEnv({ processEnv, fileEnv }) {
  return { ...fileEnv, ...processEnv };
}

export function parseDevConfig({ processEnv, fileEnv }) {
  const env = mergeDevEnv({ processEnv, fileEnv });

  const webPort = parsePort(
    env.KINDRED_WEB_PORT ?? String(DEFAULT_WEB_PORT),
    "KINDRED_WEB_PORT",
  );
  const apiPort = parsePort(
    env.KINDRED_API_PORT ?? String(DEFAULT_API_PORT),
    "KINDRED_API_PORT",
  );
  if (webPort === apiPort) {
    throw new Error(
      "KINDRED_WEB_PORT and KINDRED_API_PORT must use different ports.",
    );
  }

  let basePath = (env.BASE_PATH ?? "").trim();
  if (!basePath) basePath = "/";
  if (!basePath.startsWith("/")) {
    throw new Error('BASE_PATH must start with "/".');
  }

  const dbMode = (env.KINDRED_DEV_DB ?? "").trim().toLowerCase() || DEFAULT_DEV_DB_MODE;
  if (dbMode !== "disposable" && dbMode !== "external") {
    throw new Error(
      'KINDRED_DEV_DB must be "disposable" or "external" (received a different value).',
    );
  }
  if (dbMode === "external") {
    const missing = [];
    if (!env.MONGODB_URI?.trim()) missing.push("MONGODB_URI");
    if (!env.MONGODB_DATABASE?.trim()) missing.push("MONGODB_DATABASE");
    if (missing.length > 0) {
      throw new Error(
        `External development database requires MONGODB_URI and MONGODB_DATABASE in ${DEV_ENV_FILE} (missing: ${missing.join(", ")}).`,
      );
    }
    if (!/^mongodb(?:\+srv)?:\/\//i.test(env.MONGODB_URI.trim())) {
      throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://.");
    }
    if (!/^[A-Za-z0-9_-]{1,63}$/.test(env.MONGODB_DATABASE.trim())) {
      throw new Error(
        "MONGODB_DATABASE may only contain letters, numbers, underscores or hyphens.",
      );
    }
  }

  let apiOrigin = (env.KINDRED_API_ORIGIN ?? "").trim();
  if (!apiOrigin) apiOrigin = `http://127.0.0.1:${apiPort}`;
  try {
    // eslint-disable-next-line no-new
    new URL(apiOrigin);
  } catch {
    throw new Error("KINDRED_API_ORIGIN must be a valid absolute URL.");
  }

  // The browser child only ever receives public VITE_* values plus the
  // launcher-provided launch keys; server secrets never cross into Vite.
  const publicKeys = Object.keys(env).filter((key) => key.startsWith("VITE_"));
  const webEnv = Object.fromEntries(
    publicKeys.map((key) => [key, env[key]]),
  );

  // The API child inherits the whole development configuration so the API can
  // reach its database, Auth0 resource guard and any documented integrations.
  const apiEnv = { ...env };

  return {
    webPort,
    apiPort,
    dbMode,
    basePath,
    apiOrigin,
    webEnv,
    apiEnv,
  };
}

// ---------------------------------------------------------------------------
// Job wiring (real product commands)
// ---------------------------------------------------------------------------

// Minimal, non-secret OS environment needed to exec the workspace commands
// (pnpm resolves via PATH). We intentionally do NOT spread the launcher's full
// environment into the browser child: its env is filtered to public VITE_*
// values below, so secrets present in the launcher's environment never reach
// the Vite process that feeds the browser bundle.
const OS_ENV_KEYS = [
  "PATH",
  "HOME",
  "SHELL",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "XDG_CONFIG_HOME",
];
function minimalProcessEnv() {
  return Object.fromEntries(
    OS_ENV_KEYS.filter((key) => process.env[key] !== undefined).map((key) => [
      key,
      process.env[key],
    ]),
  );
}

export function createJobs(config, { cwd }) {
  const web = {
    name: "web",
    command: "pnpm",
    args: ["--filter", "@workspace/kindred-coach", "run", "dev"],
    cwd,
    env: {
      ...minimalProcessEnv(),
      ...config.webEnv,
      PORT: String(config.webPort),
      BASE_PATH: config.basePath,
      KINDRED_API_ORIGIN: config.apiOrigin,
    },
    stdio: "inherit",
    detached: true,
    readiness: {
      type: "port",
      port: config.webPort,
      host: "127.0.0.1",
      timeoutMs: 60_000,
    },
  };

  const api = {
    name: "api",
    command: "pnpm",
    args: ["--filter", "@workspace/api-server", "run", "start"],
    cwd,
    env: {
      ...config.apiEnv,
      PORT: String(config.apiPort),
      NODE_ENV: "development",
      // The launcher suppresses background reminder scheduling for normal
      // local development; production scheduling is unchanged (no such
      // override is set there).
      REMINDER_SCHEDULER_DISABLED: "true",
    },
    stdio: "inherit",
    detached: true,
    readiness: {
      type: "http",
      url: `${config.apiOrigin.replace(/\/$/, "")}/api/healthz/db`,
      timeoutMs: 60_000,
    },
  };

  const build = {
    name: "api-build",
    command: "pnpm",
    args: ["--filter", "@workspace/api-server", "run", "build"],
    cwd,
    env: config.apiEnv,
    stdio: "inherit",
    detached: false,
    build: true,
  };

  return { build, web, api };
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, { pollMs, timeoutMs, cancelled }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cancelled?.()) return false;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Math.min(pollMs, timeoutMs)),
      });
      if (response.ok) return true;
    } catch {
      // still starting; keep polling
    }
    await sleep(pollMs);
  }
  return false;
}

async function waitForPort(port, host, { pollMs, timeoutMs, cancelled }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cancelled?.()) return false;
    if (await checkPortInUse(port, host)) return true;
    await sleep(pollMs);
  }
  return false;
}

export async function waitForReadiness(job, options = {}) {
  const { pollMs = 200, timeoutMs = 60_000 } = options;
  if (!job.readiness) return { ok: true, job };
  const { type, timeoutMs: jobTimeoutMs = timeoutMs } = job.readiness;
  const ok =
    type === "http" && job.readiness.url
      ? await waitForHttp(job.readiness.url, {
          pollMs,
          timeoutMs: jobTimeoutMs,
          cancelled: options.cancelled,
        })
      : type === "port"
        ? await waitForPort(job.readiness.port, job.readiness.host, {
            pollMs,
            timeoutMs: jobTimeoutMs,
            cancelled: options.cancelled,
          })
        : true;
  return { ok, job };
}

// ---------------------------------------------------------------------------
// Process supervision
// ---------------------------------------------------------------------------

function runBuild(job, logger) {
  return new Promise((resolve) => {
    const child = spawn(job.command, job.args, {
      cwd: job.cwd,
      env: job.env,
      stdio: job.stdio ?? "inherit",
      detached: false,
    });
    child.once("error", (err) => {
      logger.error(`[dev] failed to start ${job.name}: ${err.message}`);
      resolve(1);
    });
    child.once("exit", (code) => resolve(typeof code === "number" ? code : 1));
  });
}

// Signal every process in the child's group (spawned detached => the child is
// its own process-group leader, so pnpm wrappers and their descendants are all
// covered). Scoped strictly to children owned by this invocation.
function signalGroup(child, signal) {
  debugLog(
    `signal pid=${child.pid} name=${child.job.name} signal=${signal} ` +
      `pgidCheck=${(() => {
        try {
          process.kill(-child.pid, 0);
          return "group-exists";
        } catch (err) {
          return err.code;
        }
      })()}`,
  );
  try {
    process.kill(-child.pid, signal);
  } catch (err) {
    if (err?.code !== "ESRCH") {
      // eslint-disable-next-line no-console
      console.error(`[dev] failed to signal ${child.job.name}: ${err.message}`);
    }
  }
}

// Run a set of jobs ({ build } jobs run to completion first) and resolve with
// the process group's final { code, reason } once everything has stopped.
export async function runDevelopment(jobs, options = {}) {
  const {
    logger = console,
    graceMs = 8000,
    pollMs = 200,
    readyTimeoutMs = 60_000,
  } = options;
  const buildJobs = jobs.filter((job) => job.build);
  const runtimeJobs = jobs.filter((job) => !job.build);

  // 1. Build phase: run to completion; a failure aborts before any child starts.
  for (const job of buildJobs) {
    const code = await runBuild(job, logger);
    if (code !== 0) {
      return { code, reason: `${job.name} failed` };
    }
  }
  if (runtimeJobs.length === 0) return { code: 0 };

  const children = new Map();
  let settled = false;
  let resolveOuter;
  const outer = new Promise((resolve) => {
    resolveOuter = resolve;
  });

  const cleanup = () =>
    new Promise((resolveCleanup) => {
      for (const child of children.values()) signalGroup(child, "SIGTERM");
      const deadline = Date.now() + graceMs;
      const tick = () => {
        const alive = [...children.values()].filter(
          (child) =>
            child.exitCode === null && child.signalCode === null && !child.killed,
        );
        if (alive.length === 0) {
          debugLog("cleanup complete (no alive owned children)");
          resolveCleanup();
          return;
        }
        if (Date.now() >= deadline) {
          const names = alive.map((child) => child.job.name).join(", ");
          debugLog(
            `cleanup force-stop names=${names} ` +
              `pids=${alive.map((child) => `${child.job.name}=${child.pid}/exitCode=${child.exitCode}/killed=${child.killed}`).join(",")}`,
          );
          logger.error(
            `[dev] graceful shutdown timed out; force-stopping: ${names}`,
          );
          for (const child of alive) signalGroup(child, "SIGKILL");
          setTimeout(resolveCleanup, 750);
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });

  const settle = async (result) => {
    if (settled) return;
    settled = true;
    await cleanup();
    resolveOuter(result);
  };

  const onSignal = (signal) => {
    logger.log(`[dev] received ${signal}; stopping dev servers...`);
    void settle({ code: 0, reason: signal });
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  let spawnFailed = false;
  for (const job of runtimeJobs) {
    const child = spawn(job.command, job.args, {
      cwd: job.cwd,
      env: job.env,
      stdio: job.stdio ?? "inherit",
      detached: true,
    });
    child.job = job;
    children.set(job.name, child);
    debugLog(`spawn name=${job.name} pid=${child.pid} cmd=${job.command} args=${JSON.stringify(job.args)}`);
    child.once("error", (err) => {
      logger.error(`[dev] failed to start ${job.name}: ${err.message}`);
      debugLog(`error name=${job.name} pid=${child.pid} message=${err.message}`);
      spawnFailed = true;
      void settle({ code: 1, reason: `spawn error: ${job.name}` });
    });
    child.once("exit", (code, signal) => {
      debugLog(`exit name=${job.name} pid=${child.pid} code=${code} signal=${signal}`);
      if (!settled) {
        const exitCode = typeof code === "number" ? code : 1;
        void settle({
          code: exitCode,
          reason: `${job.name} exited (code=${code ?? "null"}, signal=${signal ?? "none"})`,
        });
      }
    });
  }

  if (spawnFailed) {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    return { code: 1, reason: "spawn error" };
  }

  // 2. Readiness: wait until the frontend binds its port and the API answers
  //    /api/healthz/db (which also verifies the development database).
  void Promise.all(
    runtimeJobs
      .filter((job) => job.readiness)
      .map((job) =>
        waitForReadiness(job, {
          pollMs,
          timeoutMs: readyTimeoutMs,
          cancelled: () => settled,
        }),
      ),
  ).then((results) => {
    const failed = results.filter((entry) => !entry.ok);
    if (failed.length > 0 && !settled) {
      logger.error(
        `[dev] ${failed
          .map((entry) => entry.job.name)
          .join(", ")} did not become ready within ${readyTimeoutMs} ms.`,
      );
      void settle({ code: 1, reason: "readiness failed" });
    }
  });

  // Hard-exit safety net: if this process is killed without running the normal
  // cleanup path, still stop the owned detached groups.
  const onHardExit = () => forceKillOwnedGroups([...children.values()]);
  process.on("exit", onHardExit);

  const result = await outer;
  process.removeListener("SIGINT", onSignal);
  process.removeListener("SIGTERM", onSignal);
  process.removeListener("exit", onHardExit);
  debugLog(`runDevelopment resolved code=${result.code} reason=${result.reason ?? "none"}`);
  return result;
}

// Best-effort synchronous kill of owned groups on parent exit (e.g. hard
// exits) so detached children do not outlive an invocation unexpectedly.
export function forceKillOwnedGroups(runningChildren) {
  for (const child of runningChildren) signalGroup(child, "SIGKILL");
}