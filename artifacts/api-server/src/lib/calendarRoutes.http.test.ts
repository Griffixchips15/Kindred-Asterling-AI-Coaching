import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import app from "../app";
import {
  registerTestClerkIdentity,
  revokeTestClerkIdentity,
} from "../middlewares/testClerkIdentityAdapter";
import {
  fetchUpcomingEvents,
  hasCalendarConnection,
  isCalendarConfigured,
} from "./googleCalendar";

vi.mock("./googleCalendar", () => ({
  createOAuthState: vi.fn(),
  fetchUpcomingEvents: vi.fn(),
  googleAuthorizationUrl: vi.fn(),
  hasCalendarConnection: vi.fn(),
  isCalendarConfigured: vi.fn(),
  saveAuthorizationCode: vi.fn(),
  verifyOAuthState: vi.fn(),
}));

const fetchMock = vi.mocked(fetchUpcomingEvents);
const connectedMock = vi.mocked(hasCalendarConnection);
const configuredMock = vi.mocked(isCalendarConfigured);
const suffix = Math.random().toString(36).slice(2, 10);
const userId = `test-calhttp-user-${suffix}`;
let server: Server;
let baseUrl: string;
let token: string;
const tokens: string[] = [];

async function api(
  path: string,
  authToken?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  await db.insert(usersTable).values({ id: userId });
  token = registerTestClerkIdentity({ id: userId });
  tokens.push(token);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterEach(() => {
  fetchMock.mockReset();
  connectedMock.mockReset();
  configuredMock.mockReset();
});

afterAll(async () => {
  tokens.forEach(revokeTestClerkIdentity);
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await pool.end();
});

describe("GET /calendar/upcoming", () => {
  it("rejects anonymous callers", async () => {
    const response = await api("/calendar/upcoming");
    expect(response.status).toBe(401);
  });

  it("requires a connected Google account", async () => {
    configuredMock.mockReturnValue(true);
    connectedMock.mockResolvedValue(false);
    const response = await api("/calendar/upcoming", token);
    expect(response.status).toBe(409);
    expect((response.body as { error: string }).error).toBe(
      "calendar_not_connected",
    );
  });

  it("returns events for a connected user", async () => {
    configuredMock.mockReturnValue(true);
    connectedMock.mockResolvedValue(true);
    const events = [{ date: "2026-06-01", time: "9:00 AM", title: "Standup" }];
    fetchMock.mockResolvedValueOnce(events);
    const response = await api("/calendar/upcoming", token);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(events);
  });

  it("returns 502 when Google fails", async () => {
    configuredMock.mockReturnValue(true);
    connectedMock.mockResolvedValue(true);
    fetchMock.mockRejectedValueOnce(new Error("google boom"));
    const response = await api("/calendar/upcoming", token);
    expect(response.status).toBe(502);
  });
});
