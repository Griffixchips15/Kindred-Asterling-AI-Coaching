import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { initializeMongoIndexes } from "../src/mongoDb";

// This runner always creates a fresh loopback replica set, regardless of shell
// database settings. No production credentials or provider calls are required.
const replica = await MongoMemoryReplSet.create({
  binary: { version: "8.0.12" },
  replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
});
try {
  const uri = replica.getUri();
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await initializeMongoIndexes(client.db("kindred_journey_test"));
  } finally {
    await client.close();
  }
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@workspace/kindred-coach",
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.journey.config.ts",
    ],
    {
      cwd: new URL("../../..", import.meta.url),
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "test",
        TZ: "America/Edmonton",
        LOG_LEVEL: "silent",
        MONGODB_URI: uri,
        MONGODB_DATABASE: "kindred_journey_test",
        AI_PROVIDER: "disabled",
        HELCIM_PAYMENTS_ENABLED: "false",
      },
      stdio: "inherit",
    },
  );
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await replica.stop();
}
