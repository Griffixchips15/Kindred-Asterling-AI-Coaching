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
//   - Every owned child — including build-phase wrappers — is spawned detached
//     (its own process group) so cleanup signals reach pnpm wrappers and their
//     descendants, without ever using `pkill`/`killall`, port-based process
//     killing, or signalling the invoking shell's group.
//   - Signal handling (SIGINT/SIGTERM) is installed before *any* work begins so
//     interruption covers database provisioning, the build phase, spawns, and
//     runtime children. An interruption cancels further startup.
//   - Port preflight is a courtesy check; the supervisor still reacts to an
//     actual bind failure that turns into a nonzero child exit.
//   - Cleanup is scoped to owned process groups and is bounded: a graceful
//     window (SIGTERM), then a bounded force window (SIGKILL), then it resolves.
//     It also stops any registered shutdown services (e.g. a disposable DB),
//     and those service stops are bounded too: each service's graceful stop may
//     not exceed the force window, after which a supported force fallback
//     releases its owned resources and failure is reported accurately if
//     cleanup cannot be verified. A never-settling service cannot hang shutdown.
//   - A child process group is considered stopped only when every member has
//     exited — not merely when its direct child exits. Cleanup therefore waits
//     for lingering descendants (wrappers that exit while a grandchild stays).

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

// A value is "blank" when it is empty or whitespace-only. Blank VITE_* values
// are intentionally treated as unset (see parseDevConfig).
function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
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
  // Blank VITE_* values are deliberate "not set" values: they are not forwarded
  // as empty strings. That way Vite (whose process environment wins over its
  // package `.env.local`) falls back to the package-level Auth0 onboarding file
  // instead of seeing an empty string, and the shell can still override a file
  // value with an explicit nonblank assignment.
  const webEnv = {};
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITE_") && !isBlank(env[key])) webEnv[key] = env[key];
  }

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
    // Builds are owned process groups too: interrupting them mid-build must
    // stop the whole build tree without touching anything else.
    detached: true,
    build: true,
  };

  return { build, web, api };
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolve once `promise` settles, or within `ms` — whichever comes first. When
// the deadline lapses `onTimeout()` runs (a synchronous, best-effort force
// fallback that must not block), so a service whose graceful stop never settles
// can never hang shutdown indefinitely.
function withTimeout(promise, ms, onTimeout) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout();
      resolve({ timedOut: true });
    }, ms);
    promise.then(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ timedOut: false });
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ timedOut: false, error: err });
      },
    );
  });
}

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
// Process-group supervision
// ---------------------------------------------------------------------------

// A process group exists when signalling it with signal 0 does not report
// ESRCH. EPERM ("exists but not signallable") also means it exists.
function groupExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

// Signal every process in the child's group (spawned detached => the child is
// its own process-group leader, so pnpm wrappers and their descendants are all
// covered). Scoped strictly to children owned by this invocation; never the
// invoking shell's group (we always use the negative "group" form, and only
// for PIDs we successfully spawned).
function signalGroup(child, signal) {
  const pid = child?.pid;
  if (!Number.isInteger(pid) || pid <= 0) {
    debugLog(`skip signal pid=${String(pid)} signal=${signal} invalid-pid`);
    return;
  }
  debugLog(
    `signal pid=${pid} signal=${signal} ` +
      `groupExists=${groupExists(pid)} ` +
      `groupCheck=${(() => {
        try {
          process.kill(-pid, 0);
          return "group-exists";
        } catch (err) {
          return err.code;
        }
      })()}`,
  );
  // Only act on a group that exists right now; never signal an absent group.
  if (!groupExists(pid)) return;
  try {
    process.kill(-pid, signal);
  } catch (err) {
    if (err?.code !== "ESRCH") {
      // eslint-disable-next-line no-console
      console.error(
        `[dev] failed to signal ${child?.job?.name ?? "child"}: ${err.message}`,
      );
    }
  }
}

// Run a child as an owned process group and resolve when its *direct* child
// exits. Group-completion (descendants) is handled by the shutdown coordinator.
function spawnOwned(job, coordinator, logger) {
  return new Promise((resolve) => {
    const child = spawn(job.command, job.args, {
      cwd: job.cwd,
      env: job.env,
      stdio: job.stdio ?? "inherit",
      detached: true,
    });
    const group = {
      job,
      child,
      spawnError: null,
      // Once the direct child exits we must still confirm the *group* is gone
      // before considering this group stopped. If we ever observe the group as
      // absent we treat it as permanently stopped (a later "exists" can only be
      // an unrelated reuse of the pgid, which we must never signal).
      postExitGoneObserved: false,
    };
    coordinator.groups.set(job.name, group);
    debugLog(
      `spawn name=${job.name} pid=${child.pid} detached=${true} ` +
        `cmd=${job.command} args=${JSON.stringify(job.args)}`,
    );
    child.once("error", (err) => {
      group.spawnError = err;
      coordinator.groups.delete(job.name);
      logger.error(`[dev] failed to start ${job.name}: ${err.message}`);
      debugLog(`error name=${job.name} pid=${child.pid} message=${err.message}`);
      resolve({ code: 1, reason: `spawn error: ${job.name}`, error: err });
    });
    child.once("exit", (code, signal) => {
      debugLog(
        `exit name=${job.name} pid=${child.pid} code=${code} signal=${signal}`,
      );
      resolve({
        code: typeof code === "number" ? code : 1,
        signal: signal ?? null,
      });
    });
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// Coordinates SIGINT/SIGTERM handling, owned process groups and shutdown
// services (such as a disposable database) for one launcher invocation.
//
// Signal handlers are installed by the coordinator, so interruption covers the
// full startup lifecycle: database provisioning, builds, spawns and runtime.
export function createShutdownCoordinator(options = {}) {
  const {
    logger = console,
    graceMs = 8000,
    forceGraceMs = 4000,
    gracefulPollMs = 100,
  } = options;

  const groups = new Map();
  const services = new Map();

  let stopping = null;
  let stopped = false;
  let cleanupIncompleteFlag = false;
  const stopWaiters = [];
  const onStopCallbacks = [];

  const markStopped = () => {
    if (stopped) return;
    stopped = true;
    for (const waiter of stopWaiters) waiter();
    stopWaiters.length = 0;
    for (const callback of onStopCallbacks) callback();
  };

  // A group is fully stopped when: its spawn never attached a group, OR its
  // direct child has exited AND the process group no longer exists (or was
  // observed absent once, so a later "exists" can only be pgid reuse).
  const groupFullyStopped = (group) => {
    if (group.spawnError) return true;
    const { child } = group;
    const directAlive =
      child.exitCode === null && child.signalCode === null && !child.killed;
    if (directAlive) return false;
    if (group.postExitGoneObserved) return true;
    if (!groupExists(child.pid)) {
      group.postExitGoneObserved = true;
      return true;
    }
    return false;
  };

  const aliveGroups = () =>
    [...groups.values()].filter((group) => !groupFullyStopped(group));

  const stopEverything = () => {
    if (stopping) return stopping.promise;
    stopping = deferred();

    // Bounded service shutdown, decoupled from whether any process groups are
    // alive. Each service's graceful stop gets its own force window; if it has
    // not settled by then, a supported force fallback releases its owned
    // resources and the service is reported as "unverified" (cleanup could not
    // be verified). `Promise.all` over these bounded outcomes can no longer
    // hang shutdown on a never-settling service stop.
    const serviceStops = [...services.entries()].map(async ([name, service]) => {
      try {
        debugLog(`service stop name=${name}`);
        const outcome = await withTimeout(service.stop(), forceGraceMs, () => {
          if (typeof service.forceStop === "function") {
            try {
              debugLog(`service force-stop name=${name}`);
              const forced = service.forceStop();
              if (forced && typeof forced.then === "function") {
                forced.catch(() => {});
              }
            } catch (err) {
              logger.error(
                `[dev] force stop for service ${name} failed: ${err?.message ?? err}`,
              );
            }
          }
        });
        if (outcome.timedOut) {
          cleanupIncompleteFlag = true;
          logger.error(
            `[dev] service ${name} did not stop within ${forceGraceMs} ms; ` +
              "own resources were force-released if a supported fallback exists, " +
              "but its cleanup could not be verified.",
          );
        } else if (outcome.error) {
          cleanupIncompleteFlag = true;
          logger.error(
            `[dev] failed to stop service ${name}: ${outcome.error?.message ?? outcome.error}`,
          );
        } else {
          debugLog(`service stopped name=${name}`);
        }
      } catch (err) {
        // Service itself threw outside the wrapped promise (e.g. force stop).
        cleanupIncompleteFlag = true;
        logger.error(
          `[dev] failed to stop service ${name}: ${err?.message ?? err}`,
        );
      }
    });
    const allServiceStops = Promise.all(serviceStops);

    // Graceful phase: SIGTERM every owned group.
    for (const group of groups.values()) {
      if (!group.spawnError) signalGroup(group.child, "SIGTERM");
    }

    const finishStop = async () => {
      // Wait for the (bounded) service stops; never declare the stop complete
      // while an initialization that produced resources is still in flight.
      await allServiceStops;
      markStopped();
      stopping.resolve();
    };

    const deadline = Date.now() + graceMs;
    const tick = () => {
      const alive = aliveGroups();
      if (alive.length === 0) {
        void finishStop();
        return;
      }
      if (Date.now() >= deadline) {
        const names = alive.map((group) => group.job.name).join(", ");
        logger.error(
          `[dev] graceful shutdown timed out; force-stopping: ${names}`,
        );
        const forceTick = () => {
          const stillAlive = aliveGroups();
          const forceDeadlineHit = Date.now() >= deadline + forceGraceMs;
          if (stillAlive.length === 0 || forceDeadlineHit) {
            void finishStop();
            return;
          }
          for (const group of stillAlive) {
            if (!group.spawnError) signalGroup(group.child, "SIGKILL");
          }
          debugLog(
            `force-stopping names=${stillAlive.map((g) => g.job.name).join(",")}`,
          );
          setTimeout(forceTick, gracefulPollMs);
        };
        forceTick();
        return;
      }
      setTimeout(tick, gracefulPollMs);
    };
    tick();

    return stopping.promise;
  };

  const stopReasonHolder = { reason: null };

  const requestStop = (signal) => {
    if (!stopReasonHolder.reason) stopReasonHolder.reason = signal;
    // Bounded idempotent cleanup; a second signal just re-joins the same run.
    const promise = stopEverything();
    promise.then(markStopped);
    return promise;
  };

  const onSignal = (signal) => {
    logger.log(`[dev] received ${signal}; stopping dev servers...`);
    void requestStop(signal);
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  // Hard-exit safety net: if this process is about to die without running the
  // normal cleanup path (e.g. SIGKILL of the supervisor), still stop the owned
  // detached groups best-effort.
  const onHardExit = () => {
    for (const group of groups.values()) {
      if (!group.spawnError) signalGroup(group.child, "SIGKILL");
    }
  };
  process.on("exit", onHardExit);

  return {
    groups,
    services,
    addService(name, service) {
      services.set(name, service);
      return service;
    },
    // True once a stop has been requested for any reason.
    get stopReason() {
      return stopReasonHolder.reason;
    },
    groupFullyStopped,
    requestStop,
    stopEverything,
    // True once a stop has completed but a registered service could not be
    // verified as stopped (its graceful stop failed or never settled). Callers
    // use this to report the shutdown accurately.
    cleanupIncomplete() {
      return cleanupIncompleteFlag;
    },
    // Resolves when the (first) stop has fully completed. Never resolves just
    // because it was called; used to bound provisioning/startup on interruption.
    whenStopped() {
      if (stopped) return Promise.resolve();
      if (stopping) return stopping.promise;
      return new Promise((resolve) => stopWaiters.push(resolve));
    },
    // Register a callback invoked after a stop completes (used by runDevelopment
    // to unblock its own outer promise on signal).
    onStop(callback) {
      onStopCallbacks.push(callback);
    },
    dispose() {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      process.removeListener("exit", onHardExit);
    },
  };
}

// Best-effort synchronous kill of owned groups on parent exit (e.g. hard
// exits) so detached children do not outlive an invocation unexpectedly.
export function forceKillOwnedGroups(runningGroups) {
  for (const group of runningGroups) {
    if (!group.spawnError) signalGroup(group.child, "SIGKILL");
  }
}

// Run a set of jobs ({ build } jobs run to completion first) and resolve with
// the process group's final { code, reason } once everything has stopped.
//
// `coordinator` is shared with the caller (so the disposable database can be
// stopped on every exit path, including a signal during a build). Signal
// handlers belong to the coordinator; interruption cancels further startup.
export async function runDevelopment(jobs, options = {}) {
  const {
    logger = console,
    pollMs = 200,
    readyTimeoutMs = 60_000,
    buildFlushMs = 5000,
    onReady = null,
    coordinator: providedCoordinator = null,
  } = options;

  const coordinator = providedCoordinator ?? createShutdownCoordinator({ logger });
  const ownsCoordinator = !providedCoordinator;

  const finish = async (result) => {
    if (ownsCoordinator) {
      await coordinator.stopEverything();
      coordinator.dispose();
    }
    debugLog(
      `runDevelopment resolved code=${result.code} reason=${result.reason ?? "none"}`,
    );
    return result;
  };

  const buildJobs = jobs.filter((job) => job.build);
  const runtimeJobs = jobs.filter((job) => !job.build);
  const interruptible = () => Boolean(coordinator.stopReason);

  // Wait until a whole build group is gone (direct child AND descendants), so
  // we never carry a live owned group forward after a "successful" build.
  const flushGroup = (group) =>
    new Promise((resolve) => {
      const deadline = Date.now() + buildFlushMs;
      const tick = () => {
        if (interruptible() || coordinator.groupFullyStopped(group)) {
          return resolve({ stopped: coordinator.groupFullyStopped(group) });
        }
        if (Date.now() >= deadline) {
          signalGroup(group.child, "SIGKILL");
          return resolve({ stopped: false });
        }
        setTimeout(tick, pollMs);
      };
      tick();
    });

  const runCore = async () => {
    // 1. Build phase: run to completion; a failure aborts before any child
    //    starts. Builds are owned process groups, so interruption stops them
    //    too and no runtime child is spawned afterward.
    for (const job of buildJobs) {
      if (interruptible()) return { code: 0, reason: coordinator.stopReason };
      const buildResult = await spawnOwned(job, coordinator, logger);
      if (interruptible()) return { code: 0, reason: coordinator.stopReason };
      if (buildResult.code !== 0) {
        return { code: buildResult.code, reason: `${job.name} failed` };
      }
      const group = coordinator.groups.get(job.name);
      const flush = await flushGroup(group);
      if (interruptible()) return { code: 0, reason: coordinator.stopReason };
      if (!flush.stopped) {
        return {
          code: 1,
          reason: `${job.name} exited but left a running descendant`,
        };
      }
    }
    if (runtimeJobs.length === 0) return { code: 0, reason: "no runtime jobs" };

    let settled = false;
    let resolveOuter;
    const outer = new Promise((resolve) => {
      resolveOuter = resolve;
    });

    coordinator.onStop(() => {
      if (!settled) {
        settled = true;
        resolveOuter({
          code: 0,
          reason: coordinator.stopReason ?? "shutdown",
        });
      }
    });

    const settle = async (nextResult) => {
      if (settled) return;
      settled = true;
      try {
        await coordinator.stopEverything();
      } finally {
        resolveOuter(nextResult);
      }
    };

    const running = () =>
      settled || interruptible();

    // 2. Spawn runtime children as owned process groups.
    for (const job of runtimeJobs) {
      if (running()) return { code: 0, reason: coordinator.stopReason };
      const child = spawn(job.command, job.args, {
        cwd: job.cwd,
        env: job.env,
        stdio: job.stdio ?? "inherit",
        detached: true,
      });
      const group = {
        job,
        child,
        spawnError: null,
        postExitGoneObserved: false,
      };
      coordinator.groups.set(job.name, group);
      debugLog(
        `spawn name=${job.name} pid=${child.pid} detached=${true} ` +
          `cmd=${job.command} args=${JSON.stringify(job.args)}`,
      );
      child.once("error", (err) => {
        group.spawnError = err;
        coordinator.groups.delete(job.name);
        logger.error(`[dev] failed to start ${job.name}: ${err.message}`);
        void settle({ code: 1, reason: `spawn error: ${job.name}` });
      });
      child.once("exit", (code, signal) => {
        debugLog(
          `exit name=${job.name} pid=${child.pid} code=${code} signal=${signal}`,
        );
        if (settled || interruptible()) return;
        const exitCode = typeof code === "number" ? code : 1;
        void settle({
          code: exitCode,
          reason: `${job.name} exited (code=${code ?? "null"}, signal=${signal ?? "none"})`,
        });
      });
    }

    // 3. Readiness: wait until the frontend binds its port and the API answers
    //    /api/healthz/db (which also verifies the development database).
    const runtimeWithReadiness = runtimeJobs.filter((job) => job.readiness);
    if (runtimeWithReadiness.length === 0) return outer;
    void Promise.all(
      runtimeWithReadiness.map((job) =>
        waitForReadiness(job, {
          pollMs,
          timeoutMs: readyTimeoutMs,
          cancelled: running,
        }),
      ),
    ).then((results) => {
      if (running()) return;
      const failed = results.filter((entry) => !entry.ok);
      if (failed.length > 0) {
        logger.error(
          `[dev] ${failed
            .map((entry) => entry.job.name)
            .join(", ")} did not become ready within ${readyTimeoutMs} ms.`,
        );
        void settle({ code: 1, reason: "readiness failed" });
      } else if (onReady) {
        onReady(results);
      }
    });
    return outer;
  };

  try {
    return await finish(await runCore());
  } catch (err) {
    logger.error(`[dev] unexpected launcher error: ${err?.message ?? err}`);
    return finish({ code: 1, reason: "unexpected launcher error" });
  }
}