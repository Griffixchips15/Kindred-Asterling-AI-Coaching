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
import { eq } from "@workspace/db";
import { closeDatabase, db, usersTable } from "@workspace/db";
import app from "../app";
import {
  registerTestClerkIdentity,
  revokeTestClerkIdentity,
} from "../middlewares/testClerkIdentityAdapter";
import { disconnectCalendar, hasCalendarConnection } from "./googleCalendar";

vi.mock("./googleCalendar", () => ({
  disconnectCalendar: vi.fn(),
  hasCalendarConnection: vi.fn(),
}));

const disconnectMock = vi.mocked(disconnectCalendar);
const connectedMock = vi.mocked(hasCalendarConnection);
const suffix = Math.random().toString(36).slice(2, 10);
const userId = `test-calhttp-user-${suffix}`;
let server: Server;
let baseUrl: string;
let token: string;
const tokens: string[] = [];

async function api(
  path: string,
  authToken?: string,
  method = "GET",
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  const response = await fetch(`${baseUrl}${path}`, { headers, method });
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
  disconnectMock.mockReset();
  connectedMock.mockReset();
});

afterAll(async () => {
  tokens.forEach(revokeTestClerkIdentity);
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await closeDatabase();
});

describe("DELETE /calendar/connection", () => {
  it("rejects anonymous callers", async () => {
    const response = await api("/calendar/connection", undefined, "DELETE");

    expect(response.status).toBe(401);
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it("disconnects the authenticated user's Google account", async () => {
    const response = await api("/calendar/connection", token, "DELETE");

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(disconnectMock).toHaveBeenCalledOnce();
    expect(disconnectMock).toHaveBeenCalledWith(userId);
  });
});

describe("retired Calendar endpoints", () => {
  it.each(["/calendar/upcoming", "/calendar/connect", "/calendar/status", "/calendar/callback"])(
    "requires authentication on %s",
    async (path) => {
      expect((await api(path)).status).toBe(401);
      expect(connectedMock).not.toHaveBeenCalled();
    },
  );

  it.each(["/calendar/upcoming", "/calendar/connect"])(
    "returns 410 on %s even for previously connected users",
    async (path) => {
      connectedMock.mockResolvedValue(true);
      const response = await api(path, token);
      expect(response).toEqual({
        status: 410,
        body: { error: "calendar_retired" },
      });
      expect(connectedMock).not.toHaveBeenCalled();
    },
  );

  it("reports saved access for authenticated cleanup without enabling the feature", async () => {
    connectedMock.mockResolvedValue(true);
    const response = await api("/calendar/status", token);
    expect(response).toEqual({
      status: 200,
      body: { retired: true, configured: false, connected: true },
    });
    expect(connectedMock).toHaveBeenCalledWith(userId);
  });

  it("discards in-flight OAuth callbacks instead of exchanging their code", async () => {
    const response = await fetch(
      `${baseUrl}/calendar/callback?code=unused&state=unused`,
      { redirect: "manual", headers: { authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(
      /\/app\/calendar\?retired=1$/,
    );
    expect(connectedMock).not.toHaveBeenCalled();
    expect(disconnectMock).not.toHaveBeenCalled();
  });
});
