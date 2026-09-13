import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./verify-evidence.mjs";

function gitRun(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function fingerprint(cwd) {
  const head = gitRun(cwd, ["rev-parse", "HEAD"]);
  const status = gitRun(cwd, ["status", "--porcelain"]);
  return createHash("sha256").update(`${head}\0${status}\0`).digest("hex");
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
    writeFileSync(
      join(dir, ".verify-evidence.json"),
      `${JSON.stringify(
        {
          tool: "pnpm verify",
          sha: head,
          branch,
          fingerprint: fingerprint(dir),
          timestamp: new Date().toISOString(),
          node: process.version,
          components: ["format:check", "typecheck:production"],
        },
        null,
        2,
      )}\n`,
    );
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
        sha: "0".repeat(40),
        branch: "release/check",
        fingerprint: "a".repeat(64),
        timestamp: "2026-01-01T00:00:00.000Z",
        node: process.version,
        components: ["format:check"],
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
});
