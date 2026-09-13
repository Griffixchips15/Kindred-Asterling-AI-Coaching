// Shared candidate/evidence helpers for `pnpm verify` and `pnpm release:check`.
//
// `verify` stamps a JSON evidence file after a full pass; `release:check` reads
// it to tell whether the evidence belongs to the current working-tree state.
// A candidate is identified by its HEAD commit and a hash of `git status
// --porcelain`, so evidence recorded before unrelated edits is marked stale
// instead of being trusted.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

export const ROOT = process.env.KINDRED_RELEASE_ROOT
  ? resolve(process.env.KINDRED_RELEASE_ROOT)
  : fileURLToPath(new URL("..", import.meta.url));

export const EVIDENCE_FILE = join(ROOT, ".verify-evidence.json");

// Read-only git helper used by both scripts. All invocations are safe to run
// against a dirty tree and never write.
export function runGit(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

// Current candidate state: HEAD sha, branch, dirty flag and a fingerprint of
// the committed tree plus the working-tree changes.
export function candidateState() {
  const head = runGit(["rev-parse", "HEAD"]);
  const status = runGit(["status", "--porcelain"]);
  let branch = null;
  try {
    branch = runGit(["branch", "--show-current"]) || null;
  } catch {
    // detached HEAD or no git — leave null
  }
  const fingerprint = createHash("sha256").update(`${head}\0${status}\0`).digest("hex");
  return { head, branch, dirty: status.length > 0, fingerprint };
}

export function readEvidence() {
  try {
    return JSON.parse(readFileSync(EVIDENCE_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function writeEvidence({ head, branch, fingerprint, components }) {
  const evidence = {
    tool: "pnpm verify",
    sha: head,
    branch,
    fingerprint,
    timestamp: new Date().toISOString(),
    node: process.version,
    components,
  };
  writeFileSync(EVIDENCE_FILE, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}
