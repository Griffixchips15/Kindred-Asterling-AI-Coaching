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
import { createSession, deleteSession } from "./auth";
import { fetchUpcomingEvents } from "./googleCalendar";

// These tests drive the real Express calendar route over HTTP. The Google
// Calendar connector is builder-scoped (its OAuth tokens belong to the Replit
// account that connected it in the editor, not to the requesting end-user), so
// returning that data to every authenticated user would leak one person's
// schedule to the whole user base. The route therefore fails closed: it only
// serves the single allow-listed CALENDAR_OWNER_USER_ID and rejects everyone
// else. These tests prove that boundary holds and that a rejected request never
// reaches the connector. The connector itself is mocked so the suite makes no
// real Google API calls.
vi.mock("./googleCalendar", () => ({
  fetchUpcomingEvents: vi.fn(),
}));

const fetchMock = vi.mocked(fetchUpcomingEvents);

const suffix = Math.random().toString(36).slice(2, 10);
const ownerId = `test-calhttp-owner-${suffix}`;
const otherId = `test-calhttp-other-${suffix}`;

let server: Server;
let baseUrl: string;
let ownerToken: string;
let otherToken: string;
const sids: string[] = [];
const originalEnv = process.env.CALENDAR_OWNER_USER_ID;

async function makeSession(userId: string): Promise<string> {
  // No expires_at, so the auth middleware accepts the session without an OIDC
  // refresh round-trip.
  const sid = await createSession({
    user: {
      id: userId,
      email: `${userId}@example.test`,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
      emailVerifiedAt: new Date(),
    },
    access_token: "test-access-token",
  });
  sids.push(sid);
  return sid;
}

interface ApiResult {
  status: number;
  body: unknown;
}

async function api(
  method: string,
  path: string,
  opts: { token?: string } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

beforeAll(async () => {
  await db.insert(usersTable).values([
    { id: ownerId, email: `${ownerId}@example.test` },
    { id: otherId, email: `${otherId}@example.test` },
  ]);
  ownerToken = await makeSession(ownerId);
  otherToken = await makeSession(otherId);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

afterEach(() => {
  fetchMock.mockReset();
  if (originalEnv === undefined) {
    delete process.env.CALENDAR_OWNER_USER_ID;
  } else {
    process.env.CALENDAR_OWNER_USER_ID = originalEnv;
  }
});

afterAll(async () => {
  await Promise.all(sids.map((s) => deleteSession(s)));
  for (const id of [ownerId, otherId]) {
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await pool.end();
});

describe("GET /calendar/upcoming", () => {
  it("rejects anonymous callers with 401 and never hits the connector", async () => {
    process.env.CALENDAR_OWNER_USER_ID = ownerId;
    const res = await api("GET", "/calendar/upcoming");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed for everyone when CALENDAR_OWNER_USER_ID is unset", async () => {
    delete process.env.CALENDAR_OWNER_USER_ID;
    const res = await api("GET", "/calendar/upcoming", { token: ownerToken });
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("calendar_not_available");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a blank CALENDAR_OWNER_USER_ID as unset (fail closed)", async () => {
    process.env.CALENDAR_OWNER_USER_ID = "   ";
    const res = await api("GET", "/calendar/upcoming", { token: ownerToken });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("denies an authenticated non-owner and never hits the connector", async () => {
    process.env.CALENDAR_OWNER_USER_ID = ownerId;
    const res = await api("GET", "/calendar/upcoming", { token: otherToken });
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("calendar_not_available");
    // The connector (and therefore the builder's Google account) is never
    // reached for a non-owner.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves events only to the allow-listed owner", async () => {
    process.env.CALENDAR_OWNER_USER_ID = ownerId;
    const events = [{ date: "2026-06-01", time: "9:00 AM", title: "Standup" }];
    fetchMock.mockResolvedValueOnce(events);

    const res = await api("GET", "/calendar/upcoming", { token: ownerToken });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(events);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the connector call fails", async () => {
    process.env.CALENDAR_OWNER_USER_ID = ownerId;
    fetchMock.mockRejectedValueOnce(new Error("google boom"));

    const res = await api("GET", "/calendar/upcoming", { token: ownerToken });
    expect(res.status).toBe(502);
  });
});
