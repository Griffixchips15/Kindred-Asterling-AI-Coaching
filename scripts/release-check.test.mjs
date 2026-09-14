import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./verify-evidence.mjs";
import { COMPONENTS } from "./verify.mjs";
import { collectConfig } from "./release-check.mjs";

function gitRun(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

// Computes the real content-bound candidate state for a disposable repo using
// the production helper (KINDRED_RELEASE_ROOT keeps runGit bound to the repo).
function computeCandidateState(dir) {
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      `import(process.env.VERIFY_EVIDENCE_IMPORT).then((m) => process.stdout.write(JSON.stringify(m.candidateState()))).catch((e) => { console.error(e); process.exit(1); });`,
    ],
    {
      env: {
        ...process.env,
        KINDRED_RELEASE_ROOT: dir,
        VERIFY_EVIDENCE_IMPORT: pathToFileURL(join(ROOT, "scripts", "verify-evidence.mjs")).href,
      },
      encoding: "utf8",
    },
  );
  assert.equal(r.status, 0, `candidateState failed:\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

// Writes a structurally-valid, content-bound evidence stamp for the current
// repo state (full component set, schema, toolchain) — the same shape
// `pnpm verify` writes.
function stampEvidence(
  dir,
  branch,
  { components = undefined, schema = 2, toolchain = undefined, override = {} } = {},
) {
  const state = computeCandidateState(dir);
  writeFileSync(
    join(dir, ".verify-evidence.json"),
    `${JSON.stringify(
      {
        tool: "pnpm verify",
        schema,
        sha: state.head,
        branch,
        fingerprint: state.fingerprint,
        timestamp: new Date().toISOString(),
        toolchain: toolchain ?? { node: process.version },
        components: components ?? COMPONENTS.map((c) => c.name),
        ...override,
      },
      null,
      2,
    )}\n`,
  );
  return state;
}

// Creates an isolated twin of a released candidate: a committed branch whose
// HEAD is also present on origin/<branch>, an ancestor origin/main, a documented
// rollback procedure and a fresh matching verify-evidence stamp.
function makeRepo(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "release-check-"));
  gitRun(dir, ["init", "-b", "main"]);
  gitRun(dir, ["config", "user.email", "test@example.com"]);
  gitRun(dir, ["config", "user.name", "release-check-test"]);
  writeFileSync(join(dir, ".gitignore"), ".verify-evidence.json\n/docs\n");
  gitRun(dir, ["add", ".gitignore"]);
  gitRun(dir, ["commit", "-m", "base"]);
  const mainSha = gitRun(dir, ["rev-parse", "HEAD"]);
  gitRun(dir, ["checkout", "-b", "release/check"]);

  const branch = gitRun(dir, ["branch", "--show-current"]);
  writeFileSync(join(dir, "app.txt"), "candidate\n");
  gitRun(dir, ["add", "app.txt"]);
  gitRun(dir, ["commit", "-m", "candidate"]);
  const head = gitRun(dir, ["rev-parse", "HEAD"]);

  // Simulated published state: the candidate is pushed and already merged into
  // origin/main (origin/main contains the candidate as an ancestor).
  if (!overrides.noRemoteRefs) {
    gitRun(dir, ["update-ref", `refs/remotes/origin/${branch}`, head]);
    gitRun(dir, ["update-ref", "refs/remotes/origin/main", head]);
  }
  if (!overrides.noRollbackDoc) {
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "release-rollback.md"), "# Rollback\n");
  }
  if (!overrides.noEvidence) {
    stampEvidence(dir, branch);
  }
  return { dir, branch, head };
}

function runCheck({ dir, env = {} }) {
  const result = spawnSync(process.execPath, [join(ROOT, "scripts", "release-check.mjs")], {
    encoding: "utf8",
    env: {
      ...process.env,
      KINDRED_RELEASE_ROOT: dir,
      PATH: "/usr/bin:/bin",
      AUTH0_DOMAIN: env.AUTH0_DOMAIN ?? "issuer.example.com",
      AUTH0_AUDIENCE: env.AUTH0_AUDIENCE ?? "https://api.example.com/api",
      VITE_AUTH0_DOMAIN: env.VITE_AUTH0_DOMAIN ?? "issuer.example.com",
      VITE_AUTH0_CLIENT_ID: env.VITE_AUTH0_CLIENT_ID ?? "synthetic-client-id",
      VITE_AUTH0_AUDIENCE: env.VITE_AUTH0_AUDIENCE ?? "https://api.example.com/api",
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("release:check (read-only)", () => {
  test("clean candidate with fresh evidence, coherent config and pushed/merged/rollback reports only remote fields unverified (exit 8)", () => {
    const { dir } = makeRepo();
    try {
      const { status, stdout } = runCheck({ dir });
      assert.equal(status, 8);
      assert.match(stdout, /verified for this exact candidate/);
      assert.match(stdout, /push\s+verified/);
      assert.match(stdout, /merge\s+verified/);
      assert.match(stdout, /rollback\s+verified/);
      assert.match(stdout, /working tree:\s+clean/);
      assert.doesNotMatch(stdout, /INCONSISTENT/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("dirty candidate is reported dirty and its evidence is stale (exit includes 1 and 2)", () => {
    const { dir } = makeRepo();
    try {
      writeFileSync(join(dir, "app.txt"), "dirty change\n");
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence-stale bit, got exit ${status}`);
      assert.ok(status & 2, `expected dirty bit, got exit ${status}`);
      assert.match(stdout, /STALE/);
      assert.match(stdout, /DIRTY/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("evidence recorded for an older SHA is stale without a dirty tree (exit includes 1, not 2)", () => {
    const { dir } = makeRepo();
    try {
      const stale = {
        tool: "pnpm verify",
        schema: 2,
        sha: "0".repeat(40),
        branch: "release/check",
        fingerprint: "a".repeat(64),
        timestamp: "2026-01-01T00:00:00.000Z",
        toolchain: { node: process.version },
        components: COMPONENTS.map((c) => c.name),
      };
      writeFileSync(join(dir, ".verify-evidence.json"), JSON.stringify(stale, null, 2));
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence-stale bit, got exit ${status}`);
      assert.ok(!(status & 2), `did not expect dirty bit, got exit ${status}`);
      assert.match(stdout, /STALE/);
      assert.match(stdout, /working tree:\s+clean/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("missing evidence is unverified and the run does not create it (exit includes 1, file stays absent)", () => {
    const { dir } = makeRepo({ noEvidence: true });
    try {
      const { status } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence-missing bit, got exit ${status}`);
      assert.equal(
        existsSync(join(dir, ".verify-evidence.json")),
        false,
        "check must not write evidence",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("missing required config is reported without printing values (exit includes 4)", () => {
    const { dir } = makeRepo();
    try {
      const { status, stdout } = runCheck({
        dir,
        env: {
          AUTH0_DOMAIN: "",
          AUTH0_AUDIENCE: "",
          VITE_AUTH0_DOMAIN: "issuer.example.com",
          VITE_AUTH0_AUDIENCE: "https://api.example.com/api",
        },
      });
      assert.ok(status & 4, `expected config bit, got exit ${status}`);
      assert.match(stdout, /MISSING\s+AUTH0_DOMAIN/);
      assert.match(stdout, /MISSING\s+AUTH0_AUDIENCE/);
      assert.doesNotMatch(stdout, /issuer\.example\.com/);
      assert.doesNotMatch(stdout, /https:\/\/api\.example\.com/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("API and web issuer/audience mismatch is flagged as incoherent (exit includes 4)", () => {
    const { dir } = makeRepo();
    try {
      const { status, stdout } = runCheck({
        dir,
        env: {
          AUTH0_DOMAIN: "api-issuer.example.com",
          AUTH0_AUDIENCE: "https://api.example.com/api",
          VITE_AUTH0_DOMAIN: "web-issuer.example.com",
          VITE_AUTH0_AUDIENCE: "https://api.example.com/api",
        },
      });
      assert.ok(status & 4, `expected config bit, got exit ${status}`);
      assert.match(stdout, /INCONSISTENT/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing VITE_AUTH0_CLIENT_ID is incomplete even with coherent domain/audience pairs (exit includes 4)", () => {
    const { dir } = makeRepo();
    try {
      const { status, stdout } = runCheck({
        dir,
        env: { VITE_AUTH0_CLIENT_ID: "" },
      });
      assert.ok(status & 4, `expected config bit, got exit ${status}`);
      assert.match(stdout, /MISSING\s+VITE_AUTH0_CLIENT_ID/);
      assert.doesNotMatch(stdout, /INCONSISTENT/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("whitespace-only required values are reported missing, not present (exit includes 4)", () => {
    const { dir } = makeRepo();
    try {
      const { status, stdout } = runCheck({
        dir,
        env: { AUTH0_DOMAIN: "   " },
      });
      assert.ok(status & 4, `expected config bit, got exit ${status}`);
      assert.match(stdout, /MISSING\s+AUTH0_DOMAIN/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("unavailable remote refs leave push/merge unverified (exit includes 8)", () => {
    const { dir } = makeRepo({ noRemoteRefs: true });
    try {
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 8, `expected remote-unverified bit, got exit ${status}`);
      assert.match(stdout, /push\s+unverified/);
      assert.match(stdout, /merge\s+unverified/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("non-repository root exits 64 without attempting anything", () => {
    const dir = mkdtempSync(join(tmpdir(), "release-check-norepo-"));
    try {
      const { status, stdout } = runCheck({ dir });
      assert.equal(status, 64);
      assert.match(stdout, /cannot determine candidate/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the check never mutates the repository, refs or files", () => {
    const { dir } = makeRepo();
    try {
      const beforeRefs = gitRun(dir, ["for-each-ref", "--format=%(refname) %(objectname)"])
        .split("\n")
        .sort();
      const beforeStatus = gitRun(dir, ["status", "--porcelain"]);
      const evidenceBefore = existsSync(join(dir, ".verify-evidence.json"))
        ? readFileSync(join(dir, ".verify-evidence.json"), "utf8")
        : null;
      const filesBefore = gitRun(dir, ["ls-files"]).split("\n").sort();

      runCheck({ dir });
      runCheck({ dir });

      assert.equal(
        gitRun(dir, ["status", "--porcelain"]),
        beforeStatus,
        "working tree must stay identical",
      );
      assert.deepEqual(
        gitRun(dir, ["for-each-ref", "--format=%(refname) %(objectname)"]).split("\n").sort(),
        beforeRefs,
        "refs must stay identical",
      );
      assert.deepEqual(
        gitRun(dir, ["ls-files"]).split("\n").sort(),
        filesBefore,
        "tracked file set must stay identical",
      );
      assert.equal(
        existsSync(join(dir, ".verify-evidence.json"))
          ? readFileSync(join(dir, ".verify-evidence.json"), "utf8")
          : null,
        evidenceBefore,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("re-editing an already-dirty file changes the fingerprint: evidence is stale", () => {
    const { dir } = makeRepo();
    try {
      writeFileSync(join(dir, "app.txt"), "first edit\n");
      stampEvidence(dir, "release/check");
      writeFileSync(join(dir, "app.txt"), "second edit of the same path\n");
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence-stale bit, got exit ${status}`);
      assert.match(stdout, /STALE/);
      assert.match(stdout, /matching content fingerprint/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("malformed evidence is reported MALFORMED, never verified (exit includes 1)", () => {
    const { dir } = makeRepo();
    try {
      writeFileSync(join(dir, ".verify-evidence.json"), "not json at all\n");
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence bit, got exit ${status}`);
      assert.match(stdout, /MALFORMED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("evidence with a partial component set is stale even with a matching fingerprint (exit includes 1)", () => {
    const { dir } = makeRepo();
    try {
      const state = stampEvidence(dir, "release/check", {
        components: ["format:check", "typecheck:production"],
      });
      assert.equal(state.dirty, false);
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence-stale bit, got exit ${status}`);
      assert.match(stdout, new RegExp(`${String(COMPONENTS.length)} component set`));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("evidence stamped under an older schema is rejected (exit includes 1)", () => {
    const { dir } = makeRepo();
    try {
      stampEvidence(dir, "release/check", { schema: 1 });
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence bit, got exit ${status}`);
      assert.match(stdout, /MALFORMED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("evidence recorded under a different Node runtime is stale (exit includes 1)", () => {
    const { dir } = makeRepo();
    try {
      stampEvidence(dir, "release/check", { toolchain: { node: "v99.0.0" } });
      const { status, stdout } = runCheck({ dir });
      assert.ok(status & 1, `expected evidence-stale bit, got exit ${status}`);
      assert.match(stdout, /STALE/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("collectConfig uses the supplied environment (synthetic only)", () => {
  const SYNTHETIC = {
    AUTH0_DOMAIN: "issuer.example.com",
    AUTH0_AUDIENCE: "https://api.example.com/api",
    VITE_AUTH0_DOMAIN: "issuer.example.com",
    VITE_AUTH0_CLIENT_ID: "client-id",
    VITE_AUTH0_AUDIENCE: "https://api.example.com/api",
  };

  test("coherent when every required key is present, including the client id", () => {
    const config = collectConfig({ ...SYNTHETIC }, {});
    assert.equal(config.status, "coherent");
    assert.equal(config.presence.VITE_AUTH0_CLIENT_ID, true);
    assert.equal(config.coherence.issuer, true);
    assert.equal(config.coherence.audience, true);
  });

  test("web coherence reads the supplied env, not process.env", () => {
    const prev = process.env.VITE_AUTH0_DOMAIN;
    process.env.VITE_AUTH0_DOMAIN = "process-env-domain.example.com";
    try {
      const config = collectConfig({ ...SYNTHETIC }, {});
      assert.equal(config.coherence.issuer, true, "must compare against the supplied env");
      assert.equal(config.webSource, "shell");
    } finally {
      if (prev === undefined) delete process.env.VITE_AUTH0_DOMAIN;
      else process.env.VITE_AUTH0_DOMAIN = prev;
    }
  });

  test("a missing client id makes an otherwise coherent pair incomplete", () => {
    const { VITE_AUTH0_CLIENT_ID, ...withoutClientId } = SYNTHETIC;
    const config = collectConfig({ ...withoutClientId }, {});
    assert.equal(config.presence.VITE_AUTH0_CLIENT_ID, false);
    assert.equal(config.coherence.issuer, true);
    assert.equal(config.status, "incomplete");
  });

  test("whitespace-only values are missing, not present", () => {
    const config = collectConfig({ ...SYNTHETIC, AUTH0_DOMAIN: "   " }, {});
    assert.equal(config.presence.AUTH0_DOMAIN, false);
    assert.equal(config.status, "incomplete");
  });
});
