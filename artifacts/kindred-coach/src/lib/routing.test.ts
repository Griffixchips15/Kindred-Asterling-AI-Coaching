import { describe, expect, it } from "vitest";
import {
  isSafeReturnDestination,
  resolveReturnDestination,
  buildLoginUrl,
  protectedDestination,
  protectedRouteLoginTarget,
  PRICING_RETURN_PATH,
} from "./routing";

// Pure unit tests for the same-origin return-destination helpers. No DOM,
// router, or browser environment is involved — these assertions describe the
// exact strings the signed-out auth flow and the pricing checkout CTA produce.

describe("isSafeReturnDestination", () => {
  it("accepts clean same-origin absolute paths", () => {
    expect(isSafeReturnDestination("/pricing")).toBe(true);
    expect(isSafeReturnDestination("/app/morning")).toBe(true);
    expect(isSafeReturnDestination("/app")).toBe(true);
  });

  it("rejects full external URLs", () => {
    expect(isSafeReturnDestination("https://evil.example.com/pricing")).toBe(false);
    expect(isSafeReturnDestination("http://evil.example.com")).toBe(false);
  });

  it("rejects scheme-relative URLs", () => {
    expect(isSafeReturnDestination("//evil.example.com")).toBe(false);
  });

  it("rejects javascript/data schemes and backslashes/control chars", () => {
    expect(isSafeReturnDestination("javascript:alert(1)")).toBe(false);
    expect(isSafeReturnDestination("data:text/html,<script>")).toBe(false);
    expect(isSafeReturnDestination("/pricing\\evil")).toBe(false);
    expect(isSafeReturnDestination("/pricing\r\nLocation:https://evil.com")).toBe(false);
  });

  it("rejects missing, empty, or non-path values", () => {
    expect(isSafeReturnDestination(null)).toBe(false);
    expect(isSafeReturnDestination(undefined)).toBe(false);
    expect(isSafeReturnDestination("")).toBe(false);
    expect(isSafeReturnDestination("pricing")).toBe(false);
  });
});

describe("resolveReturnDestination", () => {
  it("falls back to /app when no safe destination is supplied", () => {
    expect(resolveReturnDestination(null)).toBe("/app");
    expect(resolveReturnDestination("https://evil.example.com")).toBe("/app");
    expect(resolveReturnDestination("//evil.example.com")).toBe("/app");
  });

  it("preserves a validated same-origin return destination", () => {
    expect(resolveReturnDestination("/pricing")).toBe("/pricing");
    expect(resolveReturnDestination("/app/morning")).toBe("/app/morning");
  });

  it("honours a custom fallback", () => {
    expect(resolveReturnDestination("https://evil.example.com", "/pricing")).toBe(
      "/pricing",
    );
  });
});

describe("buildLoginUrl", () => {
  it("builds the public /login URL with an encoded return destination", () => {
    expect(buildLoginUrl("/pricing")).toBe("/login?returnTo=%2Fpricing");
  });

  it("keeps the target on the public /login route (not /app/login)", () => {
    const url = buildLoginUrl("/app");
    expect(url.startsWith("/login?")).toBe(true);
    expect(url).not.toMatch(/^\/app\/login/);
  });

  it("rejects an external return destination and falls back to /app", () => {
    expect(buildLoginUrl("https://evil.example.com/pricing")).toBe(
      "/login?returnTo=%2Fapp",
    );
    expect(buildLoginUrl("//evil.example.com")).toBe("/login?returnTo=%2Fapp");
  });
});

describe("protectedDestination", () => {
  it("maps the app root to /app", () => {
    expect(protectedDestination("/")).toBe("/app");
    expect(protectedDestination(undefined)).toBe("/app");
  });

  it("maps a relative app route to its absolute protected path", () => {
    expect(protectedDestination("/morning")).toBe("/app/morning");
    expect(protectedDestination("/chat")).toBe("/app/chat");
  });

  it("tolerates a missing leading slash", () => {
    expect(protectedDestination("morning")).toBe("/app/morning");
  });
});

describe("protectedRouteLoginTarget", () => {
  it("sends a signed-out protected-route visitor to public /login", () => {
    const target = protectedRouteLoginTarget("/morning");
    expect(target.startsWith("/login?")).toBe(true);
    expect(target).not.toMatch(/^\/app\/login/);
  });

  it("preserves the requested protected destination as returnTo", () => {
    expect(protectedRouteLoginTarget("/morning")).toBe(
      "/login?returnTo=%2Fapp%2Fmorning",
    );
    expect(protectedRouteLoginTarget("/")).toBe("/login?returnTo=%2Fapp");
  });
});

describe("pricing to login", () => {
  it("routes a signed-out pricing CTA through login and back to pricing", () => {
    const target = buildLoginUrl(PRICING_RETURN_PATH);
    expect(target).toBe("/login?returnTo=%2Fpricing");
    expect(
      resolveReturnDestination(
        new URLSearchParams(target.split("?")[1]).get("returnTo"),
      ),
    ).toBe("/pricing");
  });
});
