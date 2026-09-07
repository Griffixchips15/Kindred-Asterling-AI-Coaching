import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findClerkIdentitiesByEmail } from "../middlewares/authMiddleware";
import { syncClerkIdentity } from "../lib/clerkIdentity";
import adminRouter from "./admin";

vi.mock("../middlewares/authMiddleware", () => ({
  findClerkIdentitiesByEmail: vi.fn(),
}));

vi.mock("../lib/clerkIdentity", () => ({
  syncClerkIdentity: vi.fn(),
}));

const findUsersMock = vi.mocked(findClerkIdentitiesByEmail);
const syncUserMock = vi.mocked(syncClerkIdentity);

function testApp(authenticated: boolean) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.isAuthenticated = function (this: Request) {
      return this.user != null;
    } as Request["isAuthenticated"];
    if (authenticated) {
      req.user = {
        id: "owner-app-id",
        email: "owner@example.com",
        firstName: "Owner",
        lastName: null,
        profileImageUrl: null,
        emailVerified: true,
      };
    }
    next();
  });
  app.use("/api/admin", adminRouter);
  return app;
}

describe("admin route mounting", () => {
  const previousOwnerEmails = process.env.SUBSCRIPTION_OWNER_EMAILS;

  beforeEach(() => {
    process.env.SUBSCRIPTION_OWNER_EMAILS = "owner@example.com";
    findUsersMock.mockReset();
    syncUserMock.mockReset();
  });

  afterEach(() => {
    if (previousOwnerEmails === undefined) {
      delete process.env.SUBSCRIPTION_OWNER_EMAILS;
    } else {
      process.env.SUBSCRIPTION_OWNER_EMAILS = previousOwnerEmails;
    }
  });

  it("serves the documented /api/admin/users path to an owner", async () => {
    findUsersMock.mockResolvedValue([
      {
        id: "clerk-user-id",
        email: "reviewer@example.com",
        firstName: "OAuth",
        lastName: "Reviewer",
        profileImageUrl: null,
        emailVerified: true,
      },
    ]);
    syncUserMock.mockResolvedValue({
      id: "app-user-id",
      clerkUserId: "clerk-user-id",
      clerkDeletedAt: null,
      email: "reviewer@example.com",
      passwordHash: null,
      firstName: "OAuth",
      lastName: "Reviewer",
      profileImageUrl: null,
      preferredName: null,
      birthday: null,
      struggles: null,
      strengths: null,
      interests: null,
      bio: null,
      motivationalQuote: null,
      phone: null,
      timezone: null,
      emailVerifiedAt: new Date("2026-09-07T00:00:00.000Z"),
      onboardedAt: null,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    });

    const response = await request(testApp(true)).get(
      "/api/admin/users?q=reviewer%40example.com",
    );

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([
      expect.objectContaining({
        id: "app-user-id",
        email: "reviewer@example.com",
        emailVerifiedAt: "2026-09-07T00:00:00.000Z",
      }),
    ]);
    expect(findUsersMock).toHaveBeenCalledWith("reviewer@example.com");
    expect(syncUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "clerk-user-id", imageUrl: null }),
    );
  });

  it("rejects anonymous callers on the corrected path", async () => {
    const response = await request(testApp(false)).get(
      "/api/admin/users?q=reviewer%40example.com",
    );

    expect(response.status).toBe(401);
    expect(findUsersMock).not.toHaveBeenCalled();
  });
});
