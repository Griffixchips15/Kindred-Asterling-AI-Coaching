import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import calendarRouter from "../routes/calendar";
import { disconnectCalendar } from "./googleCalendar";

vi.mock("./googleCalendar", () => ({
  createOAuthState: vi.fn(),
  disconnectCalendar: vi.fn(),
  fetchUpcomingEvents: vi.fn(),
  googleAuthorizationUrl: vi.fn(),
  hasCalendarConnection: vi.fn(),
  isCalendarConfigured: vi.fn(),
  saveAuthorizationCode: vi.fn(),
  verifyOAuthState: vi.fn(),
}));

const disconnectMock = vi.mocked(disconnectCalendar);

function testApp() {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.isAuthenticated = function (this: Request) {
      return this.user != null;
    } as Request["isAuthenticated"];
    if (req.header("authorization") === "Bearer valid-test-token") {
      req.user = {
        id: "user-123",
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        emailVerified: true,
      };
    }
    next();
  });
  app.use(calendarRouter);
  return app;
}

describe("DELETE /calendar/connection", () => {
  beforeEach(() => disconnectMock.mockReset());

  it("rejects anonymous callers", async () => {
    const response = await request(testApp()).delete("/calendar/connection");

    expect(response.status).toBe(401);
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it("disconnects only the authenticated user's connection", async () => {
    const response = await request(testApp())
      .delete("/calendar/connection")
      .set("authorization", "Bearer valid-test-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(disconnectMock).toHaveBeenCalledOnce();
    expect(disconnectMock).toHaveBeenCalledWith("user-123");
  });
});
