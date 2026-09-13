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
//   - optionally spawns a grandchild to prove that killing the process group
//     cleans up wrappers and their descendants. A grandchild is either a plain
//     interval process (dies with the group) or a "stubborn" one that ignores
//     SIGTERM/SIGINT and holds GRANDCHILD_PORT until the group is SIGKILLed
//     (see FAKE_WRAP_GRANDCHILD="stubborn").
//
// A passing child also logs received signals to SIGNAL_DIAG_FILE (helps the
// tests assert real signal delivery without guessing). A "failure-mode" child
// waits until its sibling port is reachable (so the sibling is genuinely up,
// like a real dev-time crash) and then exits with its EXIT_CODE.
//
// The fake build job supports:
//   - FAKE_BUILD_MS: exit 0 after N ms (long-running build),
//   - WRAP_EXIT_AFTER_MS: the wrapper exits 0 after N ms while leaving its
//     grandchild behind (group-completion / descendant supervision),
//   - FAKE_BUILD_GRANDCHILD: spawn a grandchild during the build (with
//     GRANDCHILD_STUBBORN / GRANDCHILD_PORT / ... to control its behaviour).

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
    const grandchild = spawn(process.execPath, ["-e", process.env.GRANDCHILD_SOURCE], {
      stdio: "ignore",
      env: process.env,
    });
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

// A grandchild that optionally ignores SIGTERM/SIGINT (stubborn) and holds a
// port so tests can prove port reuse after group cleanup.
const fakeGrandchildSource = String.raw`
const fs = require("node:fs");
const net = require("node:net");
if (process.env.GRANDCHILD_PID_FILE) {
  fs.writeFileSync(process.env.GRANDCHILD_PID_FILE, String(process.pid));
}
if (process.env.GRANDCHILD_STUBBORN === "true") {
  process.on("SIGTERM", () => {});
  process.on("SIGINT", () => {});
}
if (process.env.GRANDCHILD_PORT) {
  const server = net.createServer();
  server.once("error", (err) => {
    if (process.env.GRANDCHILD_READY_FILE) {
      fs.writeFileSync(process.env.GRANDCHILD_READY_FILE, "ERROR:" + err.code);
    }
  });
  server.listen(Number(process.env.GRANDCHILD_PORT), "127.0.0.1", () => {
    if (process.env.GRANDCHILD_READY_FILE) {
      fs.writeFileSync(process.env.GRANDCHILD_READY_FILE, String(process.pid));
    }
  });
}
setInterval(() => {}, 1000);
`;

const fakeBuildSource = String.raw`
const fs = require("node:fs");
const { spawn } = require("node:child_process");
fs.mkdirSync(process.env.FAKE_STATE_DIR, { recursive: true });
fs.writeFileSync(
  process.env.BUILD_MARKER,
  JSON.stringify({ started: true, pid: process.pid }),
);
if (process.env.FAKE_BUILD_GRANDCHILD === "true") {
  spawn(process.execPath, ["-e", process.env.GRANDCHILD_SOURCE], {
    stdio: "ignore",
    env: process.env,
  });
}
if (Number(process.env.EXIT_CODE)) {
  setTimeout(() => process.exit(Number(process.env.EXIT_CODE)), 100);
} else if (process.env.WRAP_EXIT_AFTER_MS !== "" && process.env.WRAP_EXIT_AFTER_MS !== undefined) {
  setTimeout(() => process.exit(0), Number(process.env.WRAP_EXIT_AFTER_MS));
} else if (process.env.FAKE_BUILD_MS !== "" && process.env.FAKE_BUILD_MS !== undefined) {
  setTimeout(() => process.exit(0), Number(process.env.FAKE_BUILD_MS));
} else if (process.env.FAKE_BUILD_LONG === "true") {
  // Keep building until interrupted; nothing schedules an exit.
} else {
  process.exit(0);
}
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
// crash, then exit with EXIT_CODE. Avoids the race where a child exits before
// the sibling's port is observed by the test.
waitForMarker().then(() =>
  setTimeout(() => process.exit(Number(process.env.EXIT_CODE) || 1), 250),
);
setInterval(() => {}, 1000);
`;

const grandchildEnv = () => ({
  GRANDCHILD_PID_FILE: process.env.GRANDCHILD_PID_FILE ?? "",
  GRANDCHILD_STUBBORN: process.env.GRANDCHILD_STUBBORN ?? "",
  GRANDCHILD_PORT: process.env.GRANDCHILD_PORT ?? "",
  GRANDCHILD_READY_FILE: process.env.GRANDCHILD_READY_FILE ?? "",
  GRANDCHILD_SOURCE: fakeGrandchildSource,
});

export function buildJobs(config, { cwd }) {
  const stateDir = process.env.FAKE_STATE_DIR ?? `${cwd}/.tmp`;
  const mode = process.env.FAKE_MODE ?? "ok";
  const wrap = process.env.FAKE_WRAP_GRANDCHILD ?? "";

  // Build-phase job: creates the state dir, then behaves according to the
  // FAKE_BUILD_* knobs (long-running build, early wrapper exit, grandchild).
  // Runs before any runtime child is spawned, exactly like the real API build
  // step. Exit code 7 on build failure.
  const build = {
    name: "api-build",
    command: process.execPath,
    args: ["-e", fakeBuildSource],
    cwd,
    env: {
      ...process.env,
      ...grandchildEnv(),
      EXIT_CODE: mode === "build-fail" ? "7" : "0",
      FAKE_BUILD_LONG: process.env.FAKE_BUILD_LONG ?? "",
      FAKE_BUILD_MS: process.env.FAKE_BUILD_MS ?? "",
      WRAP_EXIT_AFTER_MS: process.env.WRAP_EXIT_AFTER_MS ?? "",
      FAKE_BUILD_GRANDCHILD: process.env.FAKE_BUILD_GRANDCHILD ?? "",
      BUILD_MARKER: `${stateDir}/build.marker.json`,
      GRANDCHILD_PID_FILE: `${stateDir}/build.grandchild.pid`,
      GRANDCHILD_READY_FILE: `${stateDir}/build.grandchild.ready`,
    },
    stdio: "ignore",
    detached: true,
    build: true,
  };

  const fakeChild = (name, port) => {
    // Only the web child may carry a grandchild; scoping keeps the api child a
    // plain server (otherwise both would spawn a grandchild trying to bind the
    // same GRANDCHILD_PORT, one of them crashing on EADDRINUSE).
    const hasGrandchild = Boolean(wrap) && name === "web";
    return {
      name,
      command: process.execPath,
      args: ["-e", fakeChildSource],
      cwd,
      env: {
        ...process.env,
        ...grandchildEnv(),
        BIND_PORT: String(port),
        MARKER_FILE: `${stateDir}/${name}.marker.json`,
        GRANDCHILD_PID_FILE: hasGrandchild ? `${stateDir}/${name}.grandchild.pid` : "",
        GRANDCHILD_READY_FILE:
          hasGrandchild && wrap === "stubborn"
            ? `${stateDir}/${name}.grandchild.ready`
            : "",
        GRANDCHILD_STUBBORN: hasGrandchild && wrap === "stubborn" ? "true" : "",
      },
      stdio: "ignore",
      detached: true,
      readiness: { type: "port", port, host: "127.0.0.1", timeoutMs: 15_000 },
    };
  };

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

export { fakeGrandchildSource };