import { describe, it, expect, vi } from "vitest";
import { type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "./requireAuth";

describe("requireAuth middleware", () => {
  it("calls next() if the request is authenticated", () => {
    const req = {
      isAuthenticated: () => true,
    } as Request;

    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("responds with 401 Unauthorized if the request is not authenticated", () => {
    const req = {
      isAuthenticated: () => false,
    } as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("throws an error if isAuthenticated is missing on the request object", () => {
    // This happens if authMiddleware is not used before requireAuth
    const req = {} as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    expect(() => requireAuth(req, res, next)).toThrowError(
      /req\.isAuthenticated is not a function/
    );
  });
});
