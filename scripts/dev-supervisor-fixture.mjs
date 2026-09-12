// Test-only fixture: fake child processes that mimic the shape of the real
// dev stack (a build phase plus long-running "web"/"api" children that can
// spawn a grandchild to simulate a pnpm wrapper). Used by
// dev-supervisor.test.mjs via KINDRED_DEV_JOBS_FIXTURE; never used at runtime.
//
// The returned object matches the `{ build, web, api }` shape of
// createJobs() in dev-supervisor.mjs.
//
// Each fake runtime child:
//   - binds BIND_PORT on 127.0.0.1 so supervisor port readiness works,
//   - writes MARKER_FILE once it is listening,
//   - optionally spawns a grandchild (GRANDCHILD_PID_FILE) to prove that
//     killing the process group cleans up wrappers and their descendants.
//
// A passing child also logs received signals to SIGNAL_DIAG_FILE (helps the
// tests assert real signal delivery without guessing). A "failure-mode" child
// waits until its sibling port is reachable (so the sibling is genuinely up,
// like a real dev-time crash) and then exits with its EXIT_CODE.

const fakeChildSource = String.raw`
const net = require("node:net");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const port = Number(process.env.BIND_PORT);
const server = net.createServer();
server.listen(port, "127.0.0.1", () => {
  fs.writeFileSync(
    process.env.MARKER_FILE,
    JSON.stringify({ ready: true, pid: process.pid, port }),
  );
  if (process.env.GRANDCHILD_PID_FILE) {
    const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    fs.writeFileSync(process.env.GRANDCHILD_PID_FILE, String(grandchild.pid));
    const watcher = setInterval(() => {
      try { process.kill(grandchild.pid, 0); } catch { clearInterval(watcher); process.exit(0); }
    }, 50);
  }
  if (process.env.EXIT_CODE !== undefined) {
    setTimeout(() => process.exit(Number(process.env.EXIT_CODE)), 200);
  }
});
server.on("error", (err) => {
  fs.writeFileSync(process.env.MARKER_FILE, JSON.stringify({ ready: false, error: String(err) }));
  process.exit(1);
});
setInterval(() => {}, 1000);
`;

const fakeFailChildSource = String.raw`
const fs = require("node:fs");
const waitForMarker = () =>
  new Promise((resolve) => {
    const check = () => {
      if (fs.existsSync(process.env.SIBLING_MARKER)) return resolve();
      setTimeout(check, 25);
    };
    check();
  });
// Wait until the sibling is genuinely up (its marker is written in the listen
// callback), hold that state for a short stable window like a real dev-time
// crash, then exit with EXIT_CODE.
waitForMarker().then(() =>
  setTimeout(() => process.exit(Number(process.env.EXIT_CODE) || 1), 250),
);
setInterval(() => {}, 1000);
`;

export function buildJobs(config, { cwd }) {
  const stateDir = process.env.FAKE_STATE_DIR ?? `${cwd}/.tmp`;
  const mode = process.env.FAKE_MODE ?? "ok";
  const wrap = process.env.FAKE_WRAP_GRANDCHILD === "true";

  // Single build-phase job: creates the state dir, then exits with the mode's
  // exit code (7 on build failure, 0 otherwise). Runs before any runtime child
  // is spawned, exactly like the real API build step.
  const build = {
    name: "api-build",
    command: process.execPath,
    args: [
      "-e",
      `require('node:fs').mkdirSync(process.env.FAKE_STATE_DIR, { recursive: true }); process.exit(Number(process.env.EXIT_CODE) || 0);`,
    ],
    cwd,
    env: { ...process.env, EXIT_CODE: mode === "build-fail" ? "7" : "0" },
    stdio: "pipe",
    detached: false,
    build: true,
  };

  const fakeChild = (name, port) => ({
    name,
    command: process.execPath,
    args: ["-e", fakeChildSource],
    cwd,
    env: {
      ...process.env,
      BIND_PORT: String(port),
      MARKER_FILE: `${stateDir}/${name}.marker.json`,
      GRANDCHILD_PID_FILE: wrap ? `${stateDir}/${name}.grandchild.pid` : "",
    },
    stdio: "ignore",
    detached: true,
    readiness: { type: "port", port, host: "127.0.0.1", timeoutMs: 15_000 },
  });

  const failChild = (name, exitCode, siblingMarker) => ({
    name,
    command: process.execPath,
    args: ["-e", fakeFailChildSource],
    cwd,
    env: {
      ...process.env,
      EXIT_CODE: String(exitCode),
      SIBLING_MARKER: siblingMarker,
    },
    stdio: "ignore",
    detached: true,
  });

  const web =
    mode === "web-fail"
      ? failChild("web", 3, `${stateDir}/api.marker.json`)
      : fakeChild("web", config.webPort);
  const api =
    mode === "api-fail"
      ? failChild("api", 4, `${stateDir}/web.marker.json`)
      : fakeChild("api", config.apiPort);

  return { build, web, api };
}