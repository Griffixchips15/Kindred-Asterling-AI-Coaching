import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type Request, type Response, type NextFunction } from "express";
import { requireSubscription } from "./requireSubscription";
import { resolveSubscription } from "../lib/subscriptionService";

vi.mock("../lib/subscriptionService", () => ({
  resolveSubscription: vi.fn(),
}));

describe("requireSubscription", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");

    req = {
      user: undefined,
      log: {
        error: vi.fn(),
      }
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should call next immediately if NODE_ENV is 'test'", () => {
    vi.stubEnv("NODE_ENV", "test");
    requireSubscription(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 401 if user is not present", () => {
    requireSubscription(req as Request, res as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if email is not verified", () => {
    req.user = { id: "user-1", email: "test@example.com", emailVerifiedAt: null };
    requireSubscription(req as Request, res as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Email verification required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next if subscription is active", async () => {
    req.user = { id: "user-1", email: "test@example.com", emailVerifiedAt: new Date() };
    vi.mocked(resolveSubscription).mockResolvedValueOnce({ active: true } as any);

    requireSubscription(req as Request, res as Response, next as NextFunction);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(1);
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 402 if subscription is inactive", async () => {
    req.user = { id: "user-1", email: "test@example.com", emailVerifiedAt: new Date() };
    vi.mocked(resolveSubscription).mockResolvedValueOnce({ active: false } as any);

    requireSubscription(req as Request, res as Response, next as NextFunction);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({ error: "Subscription required" });
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 402 and log error if resolveSubscription throws", async () => {
    req.user = { id: "user-1", email: "test@example.com", emailVerifiedAt: new Date() };
    const mockError = new Error("Database connection failed");
    vi.mocked(resolveSubscription).mockRejectedValueOnce(mockError);

    requireSubscription(req as Request, res as Response, next as NextFunction);

    await vi.waitFor(() => {
      expect(req.log.error).toHaveBeenCalledWith({ err: mockError }, "subscription gate check failed");
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({ error: "Subscription required" });
    });
    expect(next).not.toHaveBeenCalled();
  });
});
