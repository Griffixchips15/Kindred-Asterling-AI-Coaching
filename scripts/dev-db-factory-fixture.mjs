// Test-only stand-in for JUST the mongodb-memory-server dependency used inside
// scripts/dev.mjs provisionDatabase. Selected with KINDRED_DEV_DB_FACTORY and
// never used at runtime: the production provisioning control flow runs
// unchanged, only the replica-set constructor is swapped.
//
// createReplicaSet(options) mirrors MongoMemoryReplSet.create(options): it
// resolves to an object with getUri() and stop(). Behaviour is chosen with:
//
//   FAKE_DB_FACTORY_MODE        delayed-success | delayed-reject | hanging-stop
//   FAKE_DB_FACTORY_DELAY_MS    delay before create resolves/rejects
//   FAKE_DB_FACTORY_PORT        port the "live" replica set binds until stopped
//   KINDRED_DEV_DB_FACTORY_OUT  marker directory (created on demand)
//
// Markers written under KINDRED_DEV_DB_FACTORY_OUT:
//   db-factory.provisioning   createReplicaSet() was called (in flight)
//   db-factory.created        create resolved; a live resource now exists
//   db-factory.stopped        stop() released the live resource
//   db-factory.force-stopped  forceStop() released the live resource
//   db-factory.rejected       create rejected (delayed-reject)

import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

function markerDir() {
  const dir = process.env.KINDRED_DEV_DB_FACTORY_OUT;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function marker(name) {
  writeFileSync(path.join(markerDir(), name), "1");
}

export function createReplicaSet() {
  const mode = process.env.FAKE_DB_FACTORY_MODE ?? "delayed-success";
  const delayMs = Number(process.env.FAKE_DB_FACTORY_DELAY_MS ?? 1500);
  marker("db-factory.provisioning");

  return new Promise((resolve, reject) => {
    // Hold the event loop until the delay elapses so signals are delivered
    // while create() is still "in flight" (mirrors a real download/start).
    const hold = setInterval(() => {}, 1000);
    const timer = setTimeout(() => {
      if (mode === "delayed-reject") {
        clearInterval(hold);
        marker("db-factory.rejected");
        reject(new Error("fixture create() rejected as configured"));
        return;
      }

      // A "live" replica set: an interval plus a bound port that must be
      // released by stop/forceStop before the launcher process can exit.
      const port = Number(process.env.FAKE_DB_FACTORY_PORT);
      const server = createServer();
      const keepAlive = setInterval(() => {}, 1000);

      if (mode === "hanging-stop") {
        // A fully-provisioned replica set whose stop() never settles. Only the
        // forceStop fallback (called by the supervisor after its deadline) can
        // release the owned resource.
        clearInterval(hold);
        server.listen(port, "127.0.0.1", () => {
          marker("db-factory.created");
          resolve({
            getUri: () => `mongodb://127.0.0.1:${port}`,
            stop: () => new Promise(() => {}),
            forceStop() {
              clearInterval(keepAlive);
              marker("db-factory.force-stopped");
              server.close(() => {});
            },
          });
        });
        return;
      }

      clearInterval(hold);
      server.listen(port, "127.0.0.1", () => {
        marker("db-factory.created");
        resolve({
          getUri: () => `mongodb://127.0.0.1:${port}`,
          stop: async () => {
            clearInterval(keepAlive);
            marker("db-factory.stopped");
            await new Promise((resolveClose) => server.close(resolveClose));
          },
        });
      });
    }, delayMs);
    timer.unref();
  });
}