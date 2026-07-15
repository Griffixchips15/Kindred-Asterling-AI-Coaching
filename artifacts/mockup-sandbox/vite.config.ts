import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
const runtimeErrorOverlay = process.env.REPL_ID
  ? (await import("@replit/vite-plugin-runtime-error-modal")).default
  : () => [];
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

// PORT and BASE_PATH are required by the dev server (set via the workflow),
// but a `vite build` run during the monorepo production build has no
// workflow context. Treat them as required for `serve`/`preview` only,
// and fall back to safe values during `build` so the production build can
// succeed even though this artifact is not deployed.
const rawPort = process.env.PORT;
const basePath = process.env.BASE_PATH;

const cartographerPlugins =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
    ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          }),
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
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...cartographerPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
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
