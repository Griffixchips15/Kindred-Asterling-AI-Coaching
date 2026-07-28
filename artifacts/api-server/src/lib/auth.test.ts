import { describe, it, expect } from "vitest";
import { getSessionId, SESSION_COOKIE } from "./auth";
import { type Request } from "express";

describe("getSessionId", () => {
  it("extracts session ID from Bearer token in authorization header", () => {
    const req = {
      headers: {
        authorization: "Bearer my-token-123",
      },
      cookies: {},
    } as unknown as Request;

    expect(getSessionId(req)).toBe("my-token-123");
  });

  it("extracts session ID from cookies if no authorization header is present", () => {
    const req = {
      headers: {},
      cookies: {
        [SESSION_COOKIE]: "my-cookie-token",
      },
    } as unknown as Request;

    expect(getSessionId(req)).toBe("my-cookie-token");
  });

  it("returns undefined if authorization header doesn't start with Bearer and no cookie is present", () => {
    const req = {
      headers: {
        authorization: "Basic my-token-123",
      },
      cookies: {},
    } as unknown as Request;

    expect(getSessionId(req)).toBeUndefined();
  });

  it("falls back to cookie if authorization header exists but doesn't start with Bearer", () => {
    const req = {
      headers: {
        authorization: "Basic user:pass",
      },
      cookies: {
        [SESSION_COOKIE]: "cookie-fallback",
      },
    } as unknown as Request;

    expect(getSessionId(req)).toBe("cookie-fallback");
  });

  it("returns undefined if no authorization header and no cookies are present", () => {
    const req = {
      headers: {},
      cookies: {},
    } as unknown as Request;

    expect(getSessionId(req)).toBeUndefined();
  });

  it("handles undefined cookies gracefully", () => {
    const req = {
      headers: {},
    } as unknown as Request;

    expect(getSessionId(req)).toBeUndefined();
  });
});
