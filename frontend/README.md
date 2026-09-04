# Kindred Next.js Frontend

This Next.js App Router project is the isolated target for features specified by Antigravity and implemented through the local Codex CLI. It does not replace the existing Vite application in `artifacts/kindred-coach/`.

## Development

Run commands from the repository root:

```bash
pnpm dev
```

The frontend is available at [http://localhost:3000](http://localhost:3000).

Use the targeted checks before handing off a change:

```bash
pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm frontend:build
```

## Antigravity to Codex workflow

1. Copy `prompts/nextjs_template.md` to a feature-specific Markdown file.
2. Fill in every placeholder, including one concrete path under `## Expected Output`.
3. Inspect the composed prompt without running Codex:

   ```bash
   pnpm codex:nextjs --dry-run prompts/<feature-name>.md
   ```

4. Run the feature through the locally installed and authenticated Codex CLI:

   ```bash
   pnpm codex:nextjs prompts/<feature-name>.md
   ```

The driver treats the feature specification as untrusted project input and runs Codex with `frontend/` as its writable workspace. It does not deploy, commit, push, or handle API keys.
