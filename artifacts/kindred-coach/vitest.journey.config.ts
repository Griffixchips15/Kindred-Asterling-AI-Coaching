import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@workspace/db": path.resolve(
        import.meta.dirname,
        "../../lib/db/src/index.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/journey/**/*.test.tsx"],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
