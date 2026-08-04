import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "./authMiddleware";
import * as authLib from "../lib/auth";

vi.mock("../lib/auth", () => ({
  getSessionId: vi.fn(),
  getSession: vi.fn(),
  clearSession: vi.fn(),
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
    vi.mocked(authLib.getSessionId).mockReturnValue(undefined);

    await authMiddleware(req, res, next);

    expect(typeof req.isAuthenticated).toBe("function");
    expect(req.isAuthenticated()).toBe(false);

    req.user = { id: "1", email: "test@example.com" } as any;
    expect(req.isAuthenticated()).toBe(true);
  });

  it("calls next immediately if no session ID is found", async () => {
    vi.mocked(authLib.getSessionId).mockReturnValue(undefined);

    await authMiddleware(req, res, next);

    expect(authLib.getSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it("clears session and calls next if session has no valid user ID", async () => {
    vi.mocked(authLib.getSessionId).mockReturnValue("fake-sid");
    vi.mocked(authLib.getSession).mockResolvedValue({ user: {} } as any);

    await authMiddleware(req, res, next);

    expect(authLib.getSession).toHaveBeenCalledWith("fake-sid");
    expect(authLib.clearSession).toHaveBeenCalledWith(res, "fake-sid");
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it("clears session and calls next if session is null", async () => {
    vi.mocked(authLib.getSessionId).mockReturnValue("fake-sid");
    vi.mocked(authLib.getSession).mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(authLib.getSession).toHaveBeenCalledWith("fake-sid");
    expect(authLib.clearSession).toHaveBeenCalledWith(res, "fake-sid");
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it("sets req.user and calls next if session has a valid user ID", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    vi.mocked(authLib.getSessionId).mockReturnValue("valid-sid");
    vi.mocked(authLib.getSession).mockResolvedValue({ user: mockUser } as any);

    await authMiddleware(req, res, next);

    expect(authLib.getSession).toHaveBeenCalledWith("valid-sid");
    expect(authLib.clearSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual(mockUser);
    expect(req.isAuthenticated()).toBe(true);
  });
});
