import { describe, expect, it } from "vitest";
import { loadEnv } from "vite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Verifies the Auth0 fallback contract the root dev launcher relies on:
//
// vite.config.ts does:
//   const auth0Env = loadEnv(mode, import.meta.dirname, "VITE_AUTH0_");
//   define: { [`import.meta.env.${key}`]: JSON.stringify(process.env[key] ?? value) }
//
// `loadEnv` merges the package's .env.local with the running process
// environment, and the constructor (process.env) takes precedence. The root
// launcher deliberately *drops blank VITE_* values before spawning Vite, so an
// unset/blank value in .env.dev behaves as “not set” and Vite falls back to
// the onboarding file — while an explicit nonblank shell value still wins.
//
// These tests drive the real `loadEnv` against synthetic .env.local files so
// the precedent is proven, not assumed.

const PREFIX = "VITE_AUTH0_";
const envKey = "VITE_AUTH0_DOMAIN";

function makeEnvDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kindred-vite-auth0-"));
  writeFileSync(
    path.join(dir, ".env.local"),
    `${envKey}=file.example.com\n`,
  );
  return dir;
}

function defineValue(key) {
  return process.env[key] ?? undefined;
}

function withProcessEnv(key, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const previous = process.env[key];
  process.env[key] = value;
  try {
    return fn();
  } finally {
    if (had) process.env[key] = previous;
    else delete process.env[key];
  }
}

describe("Vite loadEnv Auth0 fallback contract", () => {
  afterEach(() => {
    delete process.env[envKey];
    delete process.env.VITE_AUTH0_CLIENT_ID;
  });

  it("falls back to the package .env.local when nothing is set in the process env", () => {
    const dir = makeEnvDir();
    try {
      const auth0Env = loadEnv("development", dir, PREFIX);
      expect(auth0Env[envKey]).toBe("file.example.com");
      expect(defineValue(envKey) ?? auth0Env[envKey]).toBe("file.example.com");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("would let a blank forwarded value override the file (the bug blank-drop prevents)", () => {
    const dir = makeEnvDir();
    try {
      withProcessEnv(envKey, "", () => {
        const auth0Env = loadEnv("development", dir, PREFIX);
        // A blank process value beats the file value in `loadEnv`.
        expect(auth0Env[envKey]).toBe("");
        // And the config's `process.env[key] ?? value` would emit "" too.
        expect(defineValue(envKey) ?? auth0Env[envKey]).toBe("");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("restores the file fallback once blank keys are dropped (the launcher behaviour)", () => {
    const dir = makeEnvDir();
    try {
      withProcessEnv(envKey, "", () => {
        // The launcher filters blank VITE_* keys before spawning Vite.
        delete process.env[envKey];
        const auth0Env = loadEnv("development", dir, PREFIX);
        expect(auth0Env[envKey]).toBe("file.example.com");
        expect(defineValue(envKey) ?? auth0Env[envKey]).toBe("file.example.com");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lets an explicit nonblank shell value win over the file", () => {
    const dir = makeEnvDir();
    try {
      withProcessEnv(envKey, "shell.example.com", () => {
        const auth0Env = loadEnv("development", dir, PREFIX);
        expect(auth0Env[envKey]).toBe("shell.example.com");
        expect(defineValue(envKey) ?? auth0Env[envKey]).toBe("shell.example.com");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});