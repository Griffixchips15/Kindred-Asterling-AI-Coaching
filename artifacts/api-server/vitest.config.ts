import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Tests share a single MongoDB database and a single test user, so run
    // files serially to avoid cross-file interference.
    fileParallelism: false,
  },
});
