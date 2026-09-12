# Local development

`pnpm dev` at the repository root starts the **real product stack** together:

- the React/Vite production frontend (`artifacts/kindred-coach`) on `http://localhost:8080`, and
- the Express API (`artifacts/api-server`) on the same `/api` origin (the Vite dev
  server proxies `/api` to the API), backed by a disposable MongoDB.

The legacy Next.js experiment is **not** part of this command. Use
`pnpm dev:experiment` if you still need it.

## Prerequisites

- Node 24+ and pnpm (the repo pins `pnpm@10.28.1`; use it if you can: `corepack enable` + `pnpm i`).
- `pnpm i` at the root (installs workspace `node_modules`).
- Ports `8080` and `3000` free (change them in `.env.dev` if not).

## First-time setup: `.env.dev`

Copy the committed example and adjust:

```sh
cp .env.dev.example .env.dev
```

`.env.dev` is git-ignored; the launcher merges it with your shell environment
(**shell wins**), then applies safe defaults for what still is missing.

Minimum to run (`KINDRED_DEV_DB=disposable`): no local MongoDB needed. The
launcher provisions an in-memory replica set, injects its `MONGODB_URI`, and
tears it down when you stop `pnpm dev`.

- **Unset `VITE_AUTH0_CLIENT_ID`** and it falls back to `artifacts/kindred-coach/.env.local`
  (the Auth0 onboarding file) if you have it.
- **`AI_PROVIDER=disabled`** keeps the API runnable without AI infrastructure;
  switch to `openai`/`ollama`/`bedrock` (adding their keys) when you need live AI.
- Secret values (`RESEND_API_KEY`, `OPENAI_API_KEY`, calendar keys, …) belong in
  your environment or a secrets manager, **never** in `.env.dev` — everything in
  `.env.dev` flows to the browser child for `VITE_*` keys.

### Database modes

`KINDRED_DEV_DB` in `.env.dev`:

| Value        | What happens                                                   |
| ------------ | -------------------------------------------------------------- |
| `disposable` | (default) in-memory MongoDB replica set, no install needed; data is lost on exit |
| `external`   | you provide `MONGODB_URI` + `MONGODB_DATABASE` pointing at your own MongoDB |

Use `external` when you want persistent local data or need an existing dataset.

## Running

```sh
pnpm dev
```

The launcher:

1. validates configuration and checks `8080`/`3000` are free,
2. runs the API build (fails fast, so you don't hit a stale build),
3. starts the frontend and API as separate process groups and waits until both
   are ready (frontend port bound **and** `GET /api/healthz/db` answers),
4. prints readiness when both are up.

Stop with `Ctrl+C` (or `SIGTERM`). The launcher signals only the processes it
owns and waits briefly, then force-stops stragglers — nothing on the machine is
touched that it did not start. Exit code is `0` after a clean stop, non-zero
after a startup or runtime failure.

Partial startups (frontend crash, API crash, port conflict, build failure) are
surfaced with a clear reason and the other child is cleaned up.

## Verification

- API health through the Vite proxy: `curl http://localhost:8080/api/healthz/db`
- Both processes exit: `ps -ef | grep -E "kindred-coach|api-server"` after
  `Ctrl+C` shows no leftovers.

## Tests for the launcher itself

```sh
pnpm run test:dev-supervisor
```

Spawns the real CLI against fake children to prove process-group shutdown:
all owned children (and pnpm-style grandchildren) exit on SIGINT/SIGTERM and on
child/build failure, unrelated processes survive, and ports become reusable.

## Troubleshooting

- **Port already in use** — the launcher halts before starting anything and names
  the conflicting port; stop the other process or change the port in `.env.dev`.
- **`Unable to provision the disposable development database`** — the binary
  download failed; run it again or switch to `KINDRED_DEV_DB=external`.
- **Readiness never succeeds** — the launcher reports which child (frontend/API)
  did not come up; scroll the child log above the readiness line.
- **I still get reminders in dev** — the launcher always sets
  `REMINDER_SCHEDULER_DISABLED=true` on the API child only; it is not configurable
  and is never set in production.