// Tests for scripts/verify.mjs and scripts/verify-generated.mjs — the `pnpm
// verify` orchestrator. They cover orchestration-failure naming and exit-code
// propagation, the safe child environment (secrets never forwarded, synthetic
// public Auth0 values injected), generated-client drift detection including
// deleted files, the maintained formatting boundary, and (when
// RUN_VERIFY_INTEGRATION=1) a real orval re-generation proving tracked files
// stay unchanged.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { buildChildEnv, runComponent, verify, VerifyComponentError } from "./verify.mjs";
import { compareGeneratedTrees } from "./verify-generated.mjs";

const formatCheck = await import("./format-check.mjs");

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// ---------------------------------------------------------------------------
// safe child environment
// ---------------------------------------------------------------------------

describe("buildChildEnv (safe configuration)", () => {
  test("never forwards secret-like keys or VITE_* build values", () => {
    const parent = {
      PATH: "/usr/bin:/bin",
      HOME: "/home/ci",
      CI: undefined,
      VITE_AUTH0_CLIENT_SECRET: "should-never-leak",
      VITE_AUTH0_DOMAIN: "should-never-leak",
      VITE_AUTH0_CLIENT_ID: "should-never-leak",
      VITE_AUTH0_AUDIENCE: "should-never-leak",
      AUTH0_CLIENT_SECRET: "should-never-leak",
      AUTH0_MANAGEMENT_TOKEN: "should-never-leak",
      MONGODB_URI: "mongodb://secret-prod",
      OPENAI_API_KEY: "sk-should-never-leak",
      AWS_SECRET_ACCESS_KEY: "should-never-leak",
      AUTH0_DOMAIN: "real.prod.auth0",
    };
    const env = buildChildEnv(parent);
    for (const forbidden of [
      "VITE_AUTH0_CLIENT_SECRET",
      "VITE_AUTH0_DOMAIN",
      "VITE_AUTH0_CLIENT_ID",
      "VITE_AUTH0_AUDIENCE",
      "AUTH0_CLIENT_SECRET",
      "AUTH0_MANAGEMENT_TOKEN",
      "MONGODB_URI",
      "OPENAI_API_KEY",
      "AWS_SECRET_ACCESS_KEY",
      "AUTH0_DOMAIN",
    ]) {
      assert.equal(forbidden in env, false, `${forbidden} must not be forwarded`);
    }
    assert.equal(env.PATH, "/usr/bin:/bin");
    assert.equal(env.HOME, "/home/ci");
    assert.equal(env.CI, "1");
    assert.equal(env.NODE_ENV, "test");
    assert.equal(env.HELCIM_PAYMENTS_ENABLED, "false");
  });
});

// ---------------------------------------------------------------------------
// orchestration: exit-code propagation, fail-fast, component naming
// ---------------------------------------------------------------------------

describe("runComponent", () => {
  test("resolves on exit 0", async () => {
    const result = await runComponent(
      { name: "test-pass", cmd: process.execPath, args: ["-e", "process.exit(0)"] },
      { log: () => {} },
    );
    assert.equal(result.code, 0);
  });

  test("throws VerifyComponentError with component name and exit code on nonzero exit", async () => {
    await assert.rejects(
      runComponent(
        {
          name: "test-fail",
          cmd: process.execPath,
          args: ["-e", "process.exit(7)"],
        },
        { log: () => {} },
      ),
      (err) => {
        assert.ok(err instanceof VerifyComponentError);
        assert.equal(err.component, "test-fail");
        assert.equal(err.exitCode, 7);
        return true;
      },
    );
  });
});

describe("verify ordering and failure naming", () => {
  const failingRun =
    (failOn) =>
    async (component, { log = console } = {}) => {
      log(`[verify] test run ${component.name}`);
      if (component.name === failOn) {
        throw new VerifyComponentError(component.name, 3, null);
      }
      return { component: component.name, code: 0 };
    };

  test("stops at the first failing component and reports its name", async () => {
    const result = await verify({
      components: [
        { name: "a", cmd: "ignored", args: [] },
        { name: "b", cmd: "ignored", args: [] },
        { name: "c", cmd: "ignored", args: [] },
      ],
      runFn: failingRun("b"),
      log: () => {},
    });
    assert.deepEqual(result.passed, ["a"]);
    assert.equal(result.failed, "b");
    assert.equal(result.exitCode, 3);
  });

  test("reports all components passing when nothing fails", async () => {
    const result = await verify({
      components: [
        { name: "a", cmd: "ignored", args: [] },
        { name: "b", cmd: "ignored", args: [] },
      ],
      runFn: failingRun(null),
      log: () => {},
    });
    assert.deepEqual(result.passed, ["a", "b"]);
    assert.equal(result.failed, null);
  });
});

// ---------------------------------------------------------------------------
// generated-client drift detection (including deleted files)
// ---------------------------------------------------------------------------

function files(entries) {
  return new Map(
    Object.entries(entries).map(([rel, content]) => [rel, Buffer.from(content, "utf8")]),
  );
}

describe("compareGeneratedTrees", () => {
  const base = files({
    "api.ts": "export const A = 1;\n",
    "types/habit.ts": "export const habit = {};\n",
    "api.schemas.ts": "export const X = 1;\n",
    "toBeDeleted.ts": "export const legacy = 1;\n",
  });

  test("detects changed, removed (deleted) and added files separately", () => {
    const candidate = files({
      "api.ts": "export const A = 2;\n",
      "types/habit.ts": "export const habit = {};\n",
      "api.schemas.ts": "export const X = 1;\n",
      "brandNew.ts": "export const fresh = 1;\n",
    });
    const drift = compareGeneratedTrees(base, candidate);
    assert.deepEqual(drift.changed, ["api.ts"]);
    assert.deepEqual(drift.removed, ["toBeDeleted.ts"]);
    assert.deepEqual(drift.added, ["brandNew.ts"]);
  });

  test("no drift when trees match byte-for-byte", () => {
    const drift = compareGeneratedTrees(base, new Map(base));
    assert.deepEqual(drift, { removed: [], added: [], changed: [] });
  });
});

// ---------------------------------------------------------------------------
// maintained formatting boundary
// ---------------------------------------------------------------------------

describe("formatting boundary", () => {
  test("always covers the maintained developer-workflow surface", async () => {
    const files = await formatCheck.collectBoundaryFiles();
    for (const expected of [
      "scripts/verify.mjs",
      "scripts/verify-generated.mjs",
      "scripts/format-check.mjs",
      "package.json",
      ".gitlab-ci.yml",
      "pnpm-workspace.yaml",
      "lib/api-spec/orval.config.ts",
    ]) {
      assert.ok(files.includes(expected), `boundary must include ${expected}`);
    }
  });

  test("never includes lockfiles, prose docs, env files, generated output or the experiment", async () => {
    const files = await formatCheck.collectBoundaryFiles();
    for (const rel of files) {
      assert.ok(!rel.startsWith("frontend/"), `experiment must stay out: ${rel}`);
      assert.ok(!rel.startsWith("docs/"), `prose docs are outside: ${rel}`);
      assert.ok(!/\/generated\//.test(rel), `generated output is outside: ${rel}`);
      assert.ok(!/\.env/.test(rel), `env files are outside: ${rel}`);
      assert.ok(!/pnpm-lock|package-lock|yarn\.lock/.test(rel), `lockfiles are outside: ${rel}`);
    }
  });

  test("legacy pre-existing scripts stay on the documented format baseline", async () => {
    const files = await formatCheck.collectBoundaryFiles();
    for (const legacy of [
      "scripts/dev.mjs",
      "scripts/dev-supervisor.mjs",
      "scripts/dev-supervisor.test.mjs",
    ]) {
      assert.ok(!files.includes(legacy), `${legacy} must remain on the legacy baseline`);
    }
  });

  test("the enforced boundary is currently prettier-clean (format:check passes)", async () => {
    const status = await formatCheck.run();
    assert.equal(status, 0, "format:check must pass on the maintained boundary");
  });
});

// ---------------------------------------------------------------------------
// integration (opt-in): real orval re-generation keeps tracked files unchanged
// ---------------------------------------------------------------------------

describe(
  "generated-client integration (real orval)",
  { skip: process.env.RUN_VERIFY_INTEGRATION !== "1" },
  () => {
    test("running generate:check leaves tracked files byte-identical and passes", () => {
      const paths = ["lib/api-client-react/src/generated", "lib/api-zod/src/generated"];
      const before = gitStatus(paths);
      const r = spawnSync(process.execPath, ["scripts/verify-generated.mjs"], {
        cwd: ROOT,
        encoding: "utf8",
      });
      assert.equal(r.status, 0, (r.stdout || "") + (r.stderr || ""));
      assert.equal(gitStatus(paths), before, "tracked generated files must not change");
    });
  },
);

function gitStatus(paths) {
  const r = spawnSync("git", ["status", "--porcelain", "--", ...paths], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`git status failed: ${r.stderr}`);
  return r.stdout;
}
