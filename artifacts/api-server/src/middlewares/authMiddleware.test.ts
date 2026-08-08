import { describe, it, expect, vi, beforeEach } from "vitest";
import { type Request, type Response, type NextFunction } from "express";
import {
  registerTestClerkIdentity,
  revokeTestClerkIdentity,
  testClerkIdentityAdapter,
} from "./testClerkIdentityAdapter";

vi.mock("@workspace/db", () => ({
  usersTable: {},
  db: { insert: () => ({ values: () => ({ onConflictDoNothing: vi.fn() }) }) },
}));

describe("test Clerk identity adapter", () => {
  let req: Request;
  let next: NextFunction;
  beforeEach(() => {
    req = { header: vi.fn() } as unknown as Request;
    next = vi.fn();
  });

  it("leaves anonymous requests unauthenticated", async () => {
    await testClerkIdentityAdapter(req, {} as Response, next);
    expect(req.isAuthenticated()).toBe(false);
    expect(next).toHaveBeenCalledOnce();
  });

  it("resolves a registered Clerk test bearer identity", async () => {
    const token = registerTestClerkIdentity({ id: "user_123" });
    vi.mocked(req.header).mockReturnValue(`Bearer ${token}`);
    await testClerkIdentityAdapter(req, {} as Response, next);
    expect(req.user).toMatchObject({ id: "user_123", emailVerified: true });
    expect(req.isAuthenticated()).toBe(true);
    revokeTestClerkIdentity(token);
  });
});
