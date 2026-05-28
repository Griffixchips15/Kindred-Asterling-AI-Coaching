import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// PORT and BASE_PATH are set by the dev/preview workflow. A `vite build`
// during the monorepo production build runs without that workflow context,
// so enforce them only for `serve`/`preview` and fall back to safe values
// during `build`. The deployment serves this app at "/", so "/" is the
// correct production base.
const rawPort = process.env.PORT;
const basePath = process.env.BASE_PATH;

const devOnlyPlugins =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
    ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          }),
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner(),
        ),
      ]
    : [];

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
      runtimeErrorOverlay(),
      ...devOnlyPlugins,
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
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
