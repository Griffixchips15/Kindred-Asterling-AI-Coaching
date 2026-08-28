import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// PORT and BASE_PATH are set by the dev/preview workflow. A `vite build`
// during the monorepo production build runs without that workflow context,
// so enforce them only for `serve`/`preview` and fall back to safe values
// during `build`. The deployment serves this app at "/", so "/" is the
// correct production base.
const rawPort = process.env.PORT;
const basePath = process.env.BASE_PATH;

export default defineConfig(({ command }) => {
  const isServe = command === "serve";

  if (isServe) {
    if (!rawPort) {
      throw new Error(
        "PORT environment variable is required but was not provided.",
      );
    }
    const parsed = Number(rawPort);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(`Invalid PORT value: "${rawPort}"`);
    }
    if (!basePath) {
      throw new Error(
        "BASE_PATH environment variable is required but was not provided.",
      );
    }
  }

  const port = rawPort ? Number(rawPort) : 5173;
  const resolvedBase = basePath ?? "/";

  return {
    base: resolvedBase,
    plugins: [
      react(),
      tailwindcss(),
      ...(command === "build" && process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: process.env.SENTRY_ORG ?? "kindred-asterling-ai-coaching",
              project: process.env.SENTRY_PROJECT ?? "javascript-react",
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
        "use-sync-external-store/shim/index.js": path.resolve(
          import.meta.dirname,
          "src/shims/use-sync-external-store-shim.js",
        ),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
    root: path.resolve(import.meta.dirname),
    envDir: path.resolve(import.meta.dirname, "..", ".."),
    build: {
      sourcemap: "hidden",
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
