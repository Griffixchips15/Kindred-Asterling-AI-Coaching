// Narrowly scoped deterministic normalization for generated-client output.
//
// Orval's split-mode templates can leave trailing blank lines at end of file,
// which `git diff --check` flags as "new blank line at EOF". This module is the
// single canonical definition of a generated file's ending: exactly one final
// newline and no trailing blank lines or whitespace. Both the codegen script
// (lib/api-spec/package.json codegen) and generate:check (verify-generated.mjs)
// apply it so regenerating the clients never reintroduces the EOF blank line.
//
// It does NOT reformat the file body, so regenerated diffs stay minimal and the
// generated files never leave the documented formatting boundary.

import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export const GENERATED_DIRS = [
  path.join(ROOT, "lib", "api-client-react", "src", "generated"),
  path.join(ROOT, "lib", "api-zod", "src", "generated"),
];

const TEXT_EXT = new Set([".ts", ".tsx", ".mjs", ".js"]);

// Collapse trailing whitespace/blank lines to a single final newline.
export function normalizeGenerated(content) {
  const text = typeof content === "string" ? content : content.toString("utf8");
  return text.replace(/[ \t\r\n]+$/, "") + "\n";
}

async function normalizeTree(dir) {
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += await normalizeTree(abs);
    } else if (TEXT_EXT.has(path.extname(entry.name))) {
      const before = await fsp.readFile(abs, "utf8");
      const after = normalizeGenerated(before);
      if (after !== before) {
        await fsp.writeFile(abs, after, "utf8");
        count += 1;
      }
    }
  }
  return count;
}

async function main() {
  let total = 0;
  for (const dir of GENERATED_DIRS) {
    total += await normalizeTree(dir);
  }
  if (total > 0) console.log(`[normalize-generated] normalized ${total} file(s)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
