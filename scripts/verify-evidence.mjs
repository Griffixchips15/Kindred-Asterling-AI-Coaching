// Shared candidate/evidence helpers for `pnpm verify` and `pnpm release:check`.
//
// `verify` stamps a JSON evidence file after a full pass; `release:check` reads
// it to tell whether the evidence belongs to the current working-tree state.
// A candidate is identified by its HEAD commit, the raw `git status --porcelain
// -z` entries and a content hash of every changed (non-deleted) path, so two
// different contents of an already-modified file never map to the same
// fingerprint. Evidence also records the evidence schema, the complete expected
// component set and the pinned toolchain; `release:check` requires all three to
// match before anything is treated as verified. File contents and secret values
// are never stored in the evidence file.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

export const ROOT = process.env.KINDRED_RELEASE_ROOT
  ? resolve(process.env.KINDRED_RELEASE_ROOT)
  : fileURLToPath(new URL("..", import.meta.url));

export const EVIDENCE_FILE = join(ROOT, ".verify-evidence.json");

// Bump when the meaning of recorded evidence changes; release:check rejects
// evidence stamped under an older schema instead of trusting it.
export const SCHEMA_VERSION = 2;

// Read-only git helper used by both scripts. All invocations are safe to run
// against a dirty tree and never write.
export function runGit(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

// Paths appearing in `git status --porcelain -z` output. Each entry is
// `XY<space>path` (NUL-terminated); rename continuation segments have no
// status prefix and are skipped.
function changedPaths(porcelainZ) {
  const paths = [];
  for (const seg of porcelainZ.split("\0")) {
    if (!seg || seg.length < 3) continue;
    const path = seg.slice(3);
    if (path) paths.push(path);
  }
  return paths;
}

// Content hash of every changed path that still exists in the working tree.
// Deleted paths have no working content and are skipped; staged deletions that
// no longer exist on disk also fail to hash and are skipped. Rename batches a
// second NUL segment without a status prefix, which is skipped here — the new
// path is hashed and the old path is fully covered by the HEAD tree.
function hashChangedContents(porcelainZ) {
  const hasher = createHash("sha256");
  for (const seg of porcelainZ.split("\0")) {
    if (!seg || seg.length < 3) continue;
    const code = seg.slice(0, 2);
    const path = seg.slice(3);
    if (!path || code.endsWith("D")) continue;
    try {
      const blob = runGit(["hash-object", "--", path]);
      hasher.update(`${path}\0${blob}\0`);
    } catch {
      // staged deletion with no working file, or a path git cannot hash
    }
  }
  return hasher.digest("hex");
}

// Current candidate state: HEAD sha, branch, dirty flag and a content-bound
// fingerprint of the committed tree plus the working-tree changes. The raw
// porcelain entries plus the per-path content hash make the fingerprint
// sensitive to edits to an already-dirty file, not just to which paths changed.
export function candidateState() {
  const head = runGit(["rev-parse", "HEAD"]);
  // The porcelain is read untrimmed: `git status --porcelain -z` starts each
  // line with the index-status column, which is a literal space for
  // worktree-only changes — trimming it would mangle the first path.
  const porcelain = execFileSync("git", ["status", "--porcelain", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  let branch = null;
  try {
    branch = runGit(["branch", "--show-current"]) || null;
  } catch {
    // detached HEAD or no git — leave null
  }
  const contentInput = hashChangedContents(porcelain);
  const fingerprint = createHash("sha256")
    .update(`${head}\0${porcelain}\0${contentInput}\0`)
    .digest("hex");
  return {
    head,
    branch,
    dirty: porcelain.length > 0,
    fingerprint,
    changedFiles: changedPaths(porcelain).length,
  };
}

// Reviewable, deterministic toolchain identity: the running Node runtime and
// the pinned pnpm/orval versions declared in the repo. Never spawned, so it is
// identical regardless of PATH. Any change to the pins also changes the
// candidate fingerprint (they are committed files).
export function currentToolchain() {
  const toolchain = { node: process.version };
  try {
    const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    if (typeof rootPkg.packageManager === "string") {
      toolchain.pnpm = rootPkg.packageManager;
    }
  } catch {
    // toolchain degradation is not fatal; the candidate fingerprint still binds content
  }
  try {
    const specPkg = JSON.parse(readFileSync(join(ROOT, "lib", "api-spec", "package.json"), "utf8"));
    if (typeof specPkg.devDependencies?.orval === "string") {
      toolchain.orval = specPkg.devDependencies.orval;
    }
  } catch {
    // as above
  }
  return toolchain;
}

export function readEvidence(file = EVIDENCE_FILE) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function writeEvidence({ state, components, toolchain }, file = EVIDENCE_FILE) {
  const evidence = {
    tool: "pnpm verify",
    schema: SCHEMA_VERSION,
    sha: state.head,
    branch: state.branch,
    fingerprint: state.fingerprint,
    timestamp: new Date().toISOString(),
    toolchain,
    components,
  };
  writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

export function invalidateEvidence(file = EVIDENCE_FILE) {
  try {
    unlinkSync(file);
  } catch {
    // already absent
  }
}

// Returns a reason string when the parsed evidence cannot be trusted as a
// `pnpm verify` stamp for this schema, or null when it is structurally valid.
// Messy or missing fields here are treated as unverified, never as passed.
export function evidenceError(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return "evidence is not an object";
  }
  if (evidence.schema !== SCHEMA_VERSION) {
    return `schema ${String(evidence.schema)} is not ${SCHEMA_VERSION}`;
  }
  if (typeof evidence.sha !== "string" || !evidence.sha) return "missing sha";
  if (typeof evidence.fingerprint !== "string" || !evidence.fingerprint) {
    return "missing fingerprint";
  }
  if (!Array.isArray(evidence.components)) return "missing components";
  if (typeof evidence.toolchain?.node !== "string") return "missing toolchain.node";
  return null;
}
