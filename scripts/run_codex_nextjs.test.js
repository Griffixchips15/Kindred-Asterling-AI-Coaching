import assert from "node:assert/strict";
import test from "node:test";

import { composePrompt, extractTargetFile } from "./run_codex_nextjs.js";

test("extracts a target relative to frontend", () => {
  const specification = `# Feature

## Expected Output
File: frontend/components/NavBar.tsx
`;

  assert.equal(extractTargetFile(specification), "components/NavBar.tsx");
});

test("accepts App Router targets", () => {
  const specification = `# Feature

## Expected Output
File: \`app/account/page.tsx\`
`;

  assert.equal(extractTargetFile(specification), "app/account/page.tsx");
});

test("rejects paths outside frontend", () => {
  const specification = `# Feature

## Expected Output
File: ../package.json
`;

  assert.throws(
    () => extractTargetFile(specification),
    /cannot escape frontend/,
  );
});

test("rejects an unfilled template target", () => {
  const specification = `# Feature

## Expected Output
File: <relative path inside frontend>
`;

  assert.throws(() => extractTargetFile(specification), /concrete file/);
});

test("wraps the specification as untrusted input", () => {
  const prompt = composePrompt("Do the thing.", "components/Thing.tsx");

  assert.match(prompt, /untrusted project input/);
  assert.match(prompt, /<feature_specification>/);
  assert.match(prompt, /components\/Thing\.tsx/);
});
