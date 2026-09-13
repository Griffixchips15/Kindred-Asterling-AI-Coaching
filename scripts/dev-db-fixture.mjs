// Test-only stand-in for disposable database provisioning, selected with
// KINDRED_DEV_DB_FIXTURE=scripts/dev-db-fixture.mjs. Never used at runtime.
//
// Modes (FAKE_DB_MODE):
//   interrupted — provisioning is "in progress" forever. A shutdown service is
//     registered so the launcher's coordinator stops it (writing a marker) on
//     SIGINT/SIGTERM; nothing should be spawned afterward.
//   failed — provisioning throws immediately; the launcher must exit nonzero
//     without spawning anything.
//
// Markers are written under KINDRED_DEV_DB_FIXTURE_OUT (created on demand).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function markerDir() {
  const dir = process.env.KINDRED_DEV_DB_FIXTURE_OUT;
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function provisionDatabase(config, { coordinator }) {
  const mode = process.env.FAKE_DB_MODE ?? "interrupted";
  const dir = markerDir();

  if (mode === "failed") {
    writeFileSync(path.join(dir, "db-failed.started"), "1");
    throw new Error("fixture database provision failed as configured");
  }

  // interrupted: pretend the replica set is still being provisioned. Keep the
  // event loop alive so signals are delivered; the shutdown service stops us
  // (and records it) when the coordinator begins cleanup.
  const keepAlive = setInterval(() => {}, 1000);
  coordinator.addService("database", {
    stop: () => {
      clearInterval(keepAlive);
      writeFileSync(path.join(dir, "db-fixture-stopped"), "1");
      return Promise.resolve();
    },
  });
  writeFileSync(path.join(dir, "db-provisioning.started"), "1");
  await new Promise(() => {});
}