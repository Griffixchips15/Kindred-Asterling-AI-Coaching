// @vitest-environment node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/validate-auth0-build.mjs", import.meta.url),
);
const publicConfig = {
  VITE_AUTH0_DOMAIN: "tenant.example.invalid",
  VITE_AUTH0_CLIENT_ID: "synthetic-public-client",
  VITE_AUTH0_AUDIENCE: "https://api.example.invalid",
};
const run = (env: Record<string, string>) =>
  spawnSync(process.execPath, [script], { env, encoding: "utf8" });

describe("deployment authentication configuration", () => {
  it("accepts complete public configuration without printing values", () => {
    const result = run(publicConfig);
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toBe("");
  });

  it.each(Object.keys(publicConfig))("rejects missing %s", (name) => {
    const env: Record<string, string> = { ...publicConfig };
    delete env[name];
    const result = run(env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(name);
    for (const value of Object.values(publicConfig)) {
      expect(result.stderr).not.toContain(value);
    }
  });

  it("rejects whitespace-only configuration", () => {
    expect(run({ ...publicConfig, VITE_AUTH0_DOMAIN: "  " }).status).toBe(1);
  });

  it("does not accept the old Clerk build configuration as a substitute", () => {
    const result = run({ VITE_CLERK_PUBLISHABLE_KEY: "synthetic-public-key" });
    expect(result.status).toBe(1);
    for (const name of Object.keys(publicConfig)) {
      expect(result.stderr).toContain(name);
    }
    expect(result.stderr).not.toContain("synthetic-public-key");
  });
});
