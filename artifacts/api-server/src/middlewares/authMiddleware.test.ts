import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "./authMiddleware";
import type { WithAuthProp } from "@clerk/clerk-sdk-node";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const mockedGetUser = vi.fn();
vi.mock("@clerk/backend", () => {
  return {
    createClerkClient: vi.fn().mockImplementation(() => ({
      users: {
        getUser: (...args: any[]) => mockedGetUser(...args)
      }
    }))
  };
});

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    },
    usersTable: {
      id: "id",
      email: "email",
      firstName: "firstName",
      lastName: "lastName",
      profileImageUrl: "profileImageUrl",
      emailVerifiedAt: "emailVerifiedAt"
    }
  };
});

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  }
}));

describe("authMiddleware", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = {} as Request;
    res = {} as Response;
    next = vi.fn() as NextFunction;
    vi.clearAllMocks();
  });

  it("injects isAuthenticated method that checks req.user", async () => {
    await authMiddleware(req, res, next);
    expect(typeof req.isAuthenticated).toBe("function");
    expect(req.isAuthenticated()).toBe(false);
    req.user = { id: "1", email: "test@example.com" } as any;
    expect(req.isAuthenticated()).toBe(true);
  });

  it("calls next immediately if no auth user id is found", async () => {
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it("sets req.user and calls next if user is found in DB", async () => {
    const authReq = req as WithAuthProp<Request>;
    authReq.auth = { userId: "user-123", claims: null, sessionId: "session-123", actor: null } as any;

    const mockUser = { id: "user-123", email: "test@example.com" };
    vi.mocked(db.limit).mockResolvedValueOnce([mockUser]);

    await authMiddleware(req, res, next);

    expect(db.select).toHaveBeenCalled();
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledOnce();
  });

  it("fetches from Clerk and handles missing local DB user with existing email", async () => {
    const authReq = req as WithAuthProp<Request>;
    authReq.auth = { userId: "user-123", claims: null, sessionId: "session-123", actor: null } as any;

    vi.mocked(db.limit).mockResolvedValueOnce([]); // User not found by ID

    const clerkUser = {
      id: "user-123",
      emailAddresses: [{ emailAddress: "test@example.com", verification: { status: "verified" } }],
      firstName: "John",
      lastName: "Doe",
      imageUrl: "http://example.com/image.jpg"
    };
    mockedGetUser.mockResolvedValueOnce(clerkUser);

    const existingEmailUser = { id: "user-456", email: "test@example.com" }; // Different ID but same email
    vi.mocked(db.limit).mockResolvedValueOnce([existingEmailUser]);

    await authMiddleware(req, res, next);

    expect(mockedGetUser).toHaveBeenCalledWith("user-123");
    expect(req.user).toEqual(existingEmailUser);
    expect(next).toHaveBeenCalledOnce();
  });

  it("fetches from Clerk and creates new local DB user", async () => {
    const authReq = req as WithAuthProp<Request>;
    authReq.auth = { userId: "user-123", claims: null, sessionId: "session-123", actor: null } as any;

    vi.mocked(db.limit).mockResolvedValueOnce([]); // User not found by ID

    const clerkUser = {
      id: "user-123",
      emailAddresses: [{ emailAddress: "new@example.com", verification: { status: "verified" } }],
      firstName: "John",
      lastName: "Doe",
      imageUrl: "http://example.com/image.jpg"
    };
    mockedGetUser.mockResolvedValueOnce(clerkUser);

    vi.mocked(db.limit).mockResolvedValueOnce([]); // User not found by Email

    // Mock the date to have consistent assertions for emailVerifiedAt
    const mockDate = new Date("2023-01-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    await authMiddleware(req, res, next);

    expect(mockedGetUser).toHaveBeenCalledWith("user-123");
    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalledWith({
      id: "user-123",
      email: "new@example.com",
      firstName: "John",
      lastName: "Doe",
      profileImageUrl: "http://example.com/image.jpg",
      emailVerifiedAt: mockDate,
    });

    expect(req.user).toEqual({
      id: "user-123",
      email: "new@example.com",
      firstName: "John",
      lastName: "Doe",
      profileImageUrl: "http://example.com/image.jpg",
      emailVerifiedAt: mockDate,
    });

    expect(logger.info).toHaveBeenCalledWith({ userId: "user-123" }, "User auto-created from Clerk auth");
    expect(next).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it("logs warning if Clerk auto-create fails", async () => {
    const authReq = req as WithAuthProp<Request>;
    authReq.auth = { userId: "user-123", claims: null, sessionId: "session-123", actor: null } as any;

    vi.mocked(db.limit).mockResolvedValueOnce([]); // User not found by ID

    const error = new Error("Clerk API failure");
    mockedGetUser.mockRejectedValueOnce(error);

    await authMiddleware(req, res, next);

    expect(mockedGetUser).toHaveBeenCalledWith("user-123");
    expect(logger.warn).toHaveBeenCalledWith({ err: error, userId: "user-123" }, "Failed to auto-create user from Clerk auth");
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it("proceeds to Clerk fetch if initial DB lookup throws", async () => {
    const authReq = req as WithAuthProp<Request>;
    authReq.auth = { userId: "user-123", claims: null, sessionId: "session-123", actor: null } as any;

    vi.mocked(db.limit).mockRejectedValueOnce(new Error("DB failure"));

    const clerkUser = {
      id: "user-123",
      emailAddresses: [{ emailAddress: "test@example.com", verification: { status: "verified" } }],
      firstName: "John",
      lastName: "Doe",
      imageUrl: "http://example.com/image.jpg"
    };
    mockedGetUser.mockResolvedValueOnce(clerkUser);

    const existingEmailUser = { id: "user-456", email: "test@example.com" }; // Different ID but same email
    vi.mocked(db.limit).mockResolvedValueOnce([existingEmailUser]);

    await authMiddleware(req, res, next);

    expect(mockedGetUser).toHaveBeenCalledWith("user-123");
    expect(req.user).toEqual(existingEmailUser);
    expect(next).toHaveBeenCalledOnce();
  });
});
