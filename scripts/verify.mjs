// `pnpm verify` — one verification command for the production workspace.
//
// Runs the same components as the production GitLab CI path in a fixed order,
// from an isolated safe child environment that never requires or forwards
// production secrets. It fails fast: the first failing component stops the run
// with the component name and its exit code, and temporary resources are
// released on success or failure.

import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { candidateState, invalidateEvidence, writeEvidence } from "./verify-evidence.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Export the component list so tests and CI documentation stay in sync. The
// verification/release machinery regression tests live in the maintained
// path, so a bug in evidence handling fails a later `pnpm verify` run too.
export const COMPONENTS = [
  { name: "format:check", cmd: "node", args: ["scripts/format-check.mjs"] },
  { name: "typecheck:production", cmd: "pnpm", args: ["run", "typecheck:production"] },
  { name: "test:dev-supervisor", cmd: "pnpm", args: ["run", "test:dev-supervisor"] },
  { name: "test:verify", cmd: "pnpm", args: ["run", "test:verify"] },
  { name: "test:release-check", cmd: "pnpm", args: ["run", "test:release-check"] },
  {
    name: "test:frontend",
    cmd: "pnpm",
    args: ["--filter", "@workspace/kindred-coach", "run", "test"],
  },
  { name: "test:api", cmd: "pnpm", args: ["--filter", "@workspace/db", "run", "test:api"] },
  { name: "test:journey", cmd: "pnpm", args: ["--filter", "@workspace/db", "run", "test:journey"] },
  { name: "generate:check", cmd: "node", args: ["scripts/verify-generated.mjs"] },
  { name: "build:api", cmd: "pnpm", args: ["--filter", "@workspace/api-server", "run", "build"] },
  {
    name: "build:frontend",
    cmd: "pnpm",
    args: ["--filter", "@workspace/kindred-coach", "run", "build"],
  },
];

// Evidence is only recorded when the run covered the exact expected component
// set; a subset run is never a full verification.
export function componentsComplete(passed) {
  const expected = COMPONENTS.map((c) => c.name);
  return (
    Array.isArray(passed) &&
    passed.length === expected.length &&
    [...passed].sort().join("\0") === [...expected].sort().join("\0")
  );
}

const PASS_THROUGH_KEYS = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "TERM",
  "LANG",
  "LC_ALL",
  "CI",
  "FORCE_COLOR",
  "NO_COLOR",
  "NODE_ENV",
  "USER",
  "LOGNAME",
  "SHELL",
];

// Build the child environment: keep only keys needed to execute the commands
// and never forward secrets, stale local Auth0/DB environment files, or
// VITE_* build values into the checks (applications resolve their own dev
// values from their committed .env.example/.env.local instead).
export function buildChildEnv(parent = process.env) {
  const env = {};
  for (const key of PASS_THROUGH_KEYS) {
    if (parent[key] !== undefined) env[key] = parent[key];
  }
  env.NODE_ENV ??= "test";
  env.CI ??= "1";
  env.HELCIM_PAYMENTS_ENABLED ??= "false";
  env.LOG_LEVEL ??= "silent";
  return env;
}

export class VerifyComponentError extends Error {
  constructor(component, exitCode, signal) {
    super(
      `verify component "${component}" failed (exit=${exitCode ?? "null"} signal=${signal ?? "none"})`,
    );
    this.name = "VerifyComponentError";
    this.component = component;
    this.exitCode = exitCode;
    this.signal = signal;
  }
}

// Spawn a component; resolves 0 on success, throws VerifyComponentError on a
// nonzero exit/signal. `spawnFn` is injectable for tests.
export function runComponent(
  component,
  { env = buildChildEnv(), spawnFn = spawn, log = (message) => console.log(message) } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawnFn(component.cmd, component.args, {
      cwd: ROOT,
      env,
      stdio: "inherit",
    });
    child.once("error", (err) => {
      reject(new VerifyComponentError(component.name, null, `spawn:${err.message}`));
    });
    child.once("close", (code, signal) => {
      if (code === 0) {
        log(`[verify] passed  ${component.name}`);
        resolve({ component: component.name, code: 0 });
      } else {
        log(
          `[verify] FAILED  ${component.name} (exit ${code ?? "null"} signal ${signal ?? "none"})`,
        );
        reject(new VerifyComponentError(component.name, code, signal));
      }
    });
  });
}

// Run components sequentially, failing fast. Returns a summary; throws if the
// orchestrator itself cannot run a component (used by tests).
export async function verify({
  components = COMPONENTS,
  runFn = runComponent,
  log = (message) => console.log(message),
} = {}) {
  const passed = [];
  for (const component of components) {
    try {
      await runFn(component, { log });
      passed.push(component.name);
    } catch (err) {
      if (err instanceof VerifyComponentError) {
        return { passed, failed: err.component, exitCode: err.exitCode };
      }
      throw err;
    }
  }
  return { passed, failed: null, exitCode: 0 };
}

// Decide what to do with success evidence after an otherwise-passing run.
// Never leaves an older success silently valid:
//  - an interrupted run invalidates evidence outright;
//  - a working tree that changed during the run is not a stable candidate, so
//    evidence is invalidated instead of stamped;
//  - a run that did not cover the complete expected component set records no
//    success evidence.
export function finalizeEvidence({
  before,
  after,
  passed,
  interruptedSignal = null,
  evidenceFile,
  toolchain = null,
  log = (message) => console.log(message),
}) {
  if (interruptedSignal) {
    invalidateEvidence(evidenceFile);
    log(`[verify] interrupted (${interruptedSignal}); verification evidence invalidated`);
    return { action: "invalidate", reason: `interrupted (${interruptedSignal})` };
  }
  if (after.fingerprint !== before.fingerprint) {
    invalidateEvidence(evidenceFile);
    log(
      "[verify] working tree changed during the run; no verified candidate — evidence invalidated",
    );
    return { action: "invalidate", reason: "working tree changed during the run" };
  }
  if (!componentsComplete(passed)) {
    invalidateEvidence(evidenceFile);
    log(
      `[verify] run covered ${passed.length} of ${COMPONENTS.length} components; evidence invalidated`,
    );
    return { action: "invalidate", reason: "incomplete component set" };
  }
  const effectiveToolchain = toolchain ?? { node: process.version };
  return writeEvidence(
    { state: before, components: passed, toolchain: effectiveToolchain },
    evidenceFile,
  );
}

// Post-verify evidence decision covering every outcome. A failing or
// interrupted run, a working tree that changed during the run, or an
// incomplete component set never leaves an older success silently valid.
export function settleRun({
  result,
  before,
  after,
  interruptedSignal = null,
  evidenceFile,
  log = (message) => console.log(message),
}) {
  if (interruptedSignal) {
    return finalizeEvidence({
      before,
      after,
      passed: result?.passed ?? [],
      interruptedSignal,
      evidenceFile,
      log,
    });
  }
  if (result.failed) {
    invalidateEvidence(evidenceFile);
    log(`[verify] finished with a failing component: ${result.failed}`);
    return { action: "invalidate", reason: `component failed: ${result.failed}` };
  }
  return finalizeEvidence({ before, after, passed: result.passed, evidenceFile, log });
}

async function main() {
  let interruptedSignal = null;
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (interruptedSignal) process.exit(128 + (signal === "SIGINT" ? 2 : 15));
      interruptedSignal = signal;
    });
  }

  const before = candidateState();
  let result;
  try {
    result = await verify();
  } catch (err) {
    console.error(`\n[verify] internal failure: ${err.message}`);
    invalidateEvidence();
    process.exitCode = 1;
    return;
  }

  if (interruptedSignal) {
    settleRun({ result, before, after: before, interruptedSignal });
    process.exit(interruptedSignal === "SIGINT" ? 130 : 143);
  }

  const after = candidateState();
  if (result.failed) {
    settleRun({ result, before, after });
    console.error(`\n[verify] finished with a failing component: ${result.failed}`);
    process.exitCode = 1;
  } else {
    try {
      settleRun({ result, before, after });
      console.log(`\n[verify] all ${result.passed.length} components passed`);
      console.log(`[verify] verification evidence recorded for ${before.head}`);
    } catch (err) {
      console.warn(`[verify] could not record verification evidence: ${err.message}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
