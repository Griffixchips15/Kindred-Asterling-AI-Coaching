import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app.ts authentication wiring", () => {
  const app = readFileSync(new URL("../app.ts", import.meta.url), "utf8");

  it("removed the temporary Clerk diagnostics middleware", () => {
    expect(app).not.toContain("TEMPORARY DEBUG");
    expect(app).not.toContain("authenticateRequest");
    expect(app).not.toContain("createClerkClient");
    expect(app).not.toContain("@clerk/backend");
  });

  it("authenticates through the single production Clerk path", () => {
    expect(app).toContain('import { clerkMiddleware } from "@clerk/express"');
    expect(app).toContain("clerkMiddleware({");
    expect(app).toContain("app.use(authMiddleware)");
    expect(app).toContain("app.use(testClerkIdentityAdapter)");
  });

  it("keeps health routes public and ahead of Clerk", () => {
    const healthIndex = app.indexOf('app.use("/api", healthRouter)');
    const clerkIndex = app.indexOf("clerkMiddleware({");
    expect(healthIndex).toBeGreaterThanOrEqual(0);
    expect(clerkIndex).toBeGreaterThan(0);
    expect(healthIndex).toBeLessThan(clerkIndex);
  });

  it("does not log tokens, authorization headers, or raw Clerk state", () => {
    const auth = readFileSync(
      new URL("../middlewares/authMiddleware.ts", import.meta.url),
      "utf8",
    );

    // The removed debug middleware was the only place that serialised the full
    // Clerk request state; the remaining auth logging uses abstract fields only.
    expect(app).not.toContain("logger.warn({ state }");
    expect(auth).not.toMatch(/req\.headers/);
    expect(auth).not.toMatch(/authorization/i);
  });
});
