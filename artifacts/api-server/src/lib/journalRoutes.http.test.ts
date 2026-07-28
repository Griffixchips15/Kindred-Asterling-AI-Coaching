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
import {
  db,
  pool,
  usersTable,
  habitsTable,
  morningLogsTable,
  bodyScansTable,
  eveningReportsTable,
} from "@workspace/db";
import * as writeContract from "./writeContract";
import app from "../app";
import { createSession, deleteSession } from "./auth";

// These tests drive the real Express routes over HTTP (auth middleware, request
// validation, status codes, and the write transactions wired into each route).
// finalizeWrite — the closing step inside every journal write transaction — is
// wrapped in a spy so a test can force it to throw mid-save and prove the route
// responds 500 and leaves no rows behind.
vi.mock("./writeContract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./writeContract")>();
  return {
    ...actual,
    finalizeWrite: vi.fn(actual.finalizeWrite),
  };
});

const finalizeSpy = vi.mocked(writeContract.finalizeWrite);

function failFinalizeOnce() {
  finalizeSpy.mockImplementationOnce(() => {
    throw new Error("finalize boom");
  });
}

const suffix = Math.random().toString(36).slice(2, 10);
const userAId = `test-http-a-${suffix}`;
const userBId = `test-http-b-${suffix}`;
const TODAY = "2026-05-29";

let server: Server;
let baseUrl: string;
let tokenA: string;
let tokenB: string;
const sids: string[] = [];

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
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
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
    { id: userAId, email: `${userAId}@example.test` },
    { id: userBId, email: `${userBId}@example.test` },
  ]);
  tokenA = await makeSession(userAId);
  tokenB = await makeSession(userBId);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

afterEach(async () => {
  finalizeSpy.mockClear();
  for (const id of [userAId, userBId]) {
    // Cascade removes habit entries owned by the user's habits.
    await db.delete(habitsTable).where(eq(habitsTable.userId, id));
    await db.delete(morningLogsTable).where(eq(morningLogsTable.userId, id));
    await db.delete(bodyScansTable).where(eq(bodyScansTable.userId, id));
    await db
      .delete(eveningReportsTable)
      .where(eq(eveningReportsTable.userId, id));
  }
  // Reset profile fields touched by the profile tests.
  await db
    .update(usersTable)
    .set({ preferredName: null, bio: null })
    .where(eq(usersTable.id, userAId));
});

afterAll(async () => {
  await Promise.all(sids.map((s) => deleteSession(s)));
  for (const id of [userAId, userBId]) {
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await pool.end();
});

describe("auth is required", () => {
  const anonymousCases: { method: string; path: string; body?: unknown }[] = [
    { method: "GET", path: "/habits" },
    { method: "POST", path: "/habits", body: { name: "Anon", targetDays: 90 } },
    { method: "GET", path: "/habits/1/entries" },
    {
      method: "POST",
      path: "/habits/1/entries",
      body: { date: TODAY, completed: true },
    },
    { method: "GET", path: "/morning-logs" },
    {
      method: "POST",
      path: "/morning-logs",
      body: { date: TODAY, mentalLoadLevel: "low", miniGoals: [] },
    },
    { method: "GET", path: "/morning-logs/1" },
    { method: "GET", path: "/body-scans" },
    {
      method: "POST",
      path: "/body-scans",
      body: { feelings: [], energyLevel: 5 },
    },
    { method: "GET", path: "/evening-reports" },
    {
      method: "POST",
      path: "/evening-reports",
      body: { date: TODAY, medicationEffectiveness: 5 },
    },
    { method: "PATCH", path: "/profile", body: { preferredName: "Anon" } },
  ];

  it.each(anonymousCases)(
    "rejects anonymous $method $path with 401",
    async ({ method, path, body }) => {
      const res = await api(method, path, { body });
      expect(res.status).toBe(401);
    },
  );
});

describe("POST/GET /habits", () => {
  it("creates a habit and reads it back for the owner", async () => {
    const created = await api("POST", "/habits", {
      token: tokenA,
      body: { name: "Drink water", targetDays: 90, startDate: TODAY },
    });
    expect(created.status).toBe(201);
    expect((created.body as { id: number }).id).toBeTypeOf("number");

    const list = await api("GET", "/habits", { token: tokenA });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("does not leak one user's habits to another user", async () => {
    await api("POST", "/habits", {
      token: tokenA,
      body: { name: "Private", targetDays: 90, startDate: TODAY },
    });

    const list = await api("GET", "/habits", { token: tokenB });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });

  it("rolls back and returns 500 when the save fails mid-transaction", async () => {
    failFinalizeOnce();

    const res = await api("POST", "/habits", {
      token: tokenA,
      body: { name: "Doomed", targetDays: 90, startDate: TODAY },
    });
    expect(res.status).toBe(500);

    const list = await api("GET", "/habits", { token: tokenA });
    expect(list.body).toHaveLength(0);
  });
});

describe("POST/GET /habits/:id/entries", () => {
  async function createHabit(token: string): Promise<number> {
    const res = await api("POST", "/habits", {
      token,
      body: { name: "Stretch", targetDays: 90, startDate: TODAY },
    });
    return (res.body as { id: number }).id;
  }

  it("logs an entry for a habit the caller owns", async () => {
    const habitId = await createHabit(tokenA);
    const res = await api("POST", `/habits/${habitId}/entries`, {
      token: tokenA,
      body: { date: TODAY, completed: true },
    });
    expect(res.status).toBe(201);
    expect((res.body as { habitId: number }).habitId).toBe(habitId);
  });

  it("returns 404 when another user tries to log against your habit", async () => {
    const habitId = await createHabit(tokenA);
    const res = await api("POST", `/habits/${habitId}/entries`, {
      token: tokenB,
      body: { date: TODAY, completed: true },
    });
    expect(res.status).toBe(404);

    // The owner still has no entries — nothing was written.
    const entries = await api("GET", `/habits/${habitId}/entries`, {
      token: tokenA,
    });
    expect(entries.body).toHaveLength(0);
  });

  it("returns 404 when another user tries to read your habit's entries", async () => {
    const habitId = await createHabit(tokenA);
    const res = await api("GET", `/habits/${habitId}/entries`, {
      token: tokenB,
    });
    expect(res.status).toBe(404);
  });

  it("rolls back and returns 500 when the entry save fails", async () => {
    const habitId = await createHabit(tokenA);
    failFinalizeOnce();

    const res = await api("POST", `/habits/${habitId}/entries`, {
      token: tokenA,
      body: { date: TODAY, completed: true },
    });
    expect(res.status).toBe(500);

    const entries = await api("GET", `/habits/${habitId}/entries`, {
      token: tokenA,
    });
    expect(entries.body).toHaveLength(0);
  });
});

describe("POST/GET /morning-logs", () => {
  it("creates a morning log for the owner", async () => {
    const res = await api("POST", "/morning-logs", {
      token: tokenA,
      body: { date: TODAY, mentalLoadLevel: "medium", miniGoals: ["walk"] },
    });
    expect(res.status).toBe(201);
  });

  it("returns 404 when another user reads your morning log by id", async () => {
    const created = await api("POST", "/morning-logs", {
      token: tokenA,
      body: { date: TODAY, mentalLoadLevel: "medium", miniGoals: [] },
    });
    const id = (created.body as { id: number }).id;

    const asOther = await api("GET", `/morning-logs/${id}`, { token: tokenB });
    expect(asOther.status).toBe(404);

    const asOwner = await api("GET", `/morning-logs/${id}`, { token: tokenA });
    expect(asOwner.status).toBe(200);
  });

  it("does not leak one user's morning logs to another user", async () => {
    await api("POST", "/morning-logs", {
      token: tokenA,
      body: { date: TODAY, mentalLoadLevel: "medium", miniGoals: [] },
    });

    const list = await api("GET", "/morning-logs", { token: tokenB });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });

  it("rolls back and returns 500 when the save fails", async () => {
    failFinalizeOnce();
    const res = await api("POST", "/morning-logs", {
      token: tokenA,
      body: { date: TODAY, mentalLoadLevel: "high", miniGoals: [] },
    });
    expect(res.status).toBe(500);

    const list = await api("GET", "/morning-logs", { token: tokenA });
    expect(list.body).toHaveLength(0);
  });
});

describe("POST/GET /body-scans", () => {
  it("creates a body scan for the owner", async () => {
    const res = await api("POST", "/body-scans", {
      token: tokenA,
      body: { feelings: ["calm"], energyLevel: 7 },
    });
    expect(res.status).toBe(201);
  });

  it("does not leak one user's body scans to another user", async () => {
    await api("POST", "/body-scans", {
      token: tokenA,
      body: { feelings: ["calm"], energyLevel: 7 },
    });

    const list = await api("GET", "/body-scans", { token: tokenB });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });

  it("rolls back and returns 500 when the save fails", async () => {
    failFinalizeOnce();
    const res = await api("POST", "/body-scans", {
      token: tokenA,
      body: { feelings: [], energyLevel: 3 },
    });
    expect(res.status).toBe(500);

    const list = await api("GET", "/body-scans", { token: tokenA });
    expect(list.body).toHaveLength(0);
  });
});

describe("POST/GET /evening-reports", () => {
  it("creates an evening report for the owner", async () => {
    const res = await api("POST", "/evening-reports", {
      token: tokenA,
      body: { date: TODAY, medicationEffectiveness: 6, overallMood: "okay" },
    });
    expect(res.status).toBe(201);
  });

  it("does not leak one user's evening reports to another user", async () => {
    await api("POST", "/evening-reports", {
      token: tokenA,
      body: { date: TODAY, medicationEffectiveness: 6, overallMood: "okay" },
    });

    const list = await api("GET", "/evening-reports", { token: tokenB });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });

  it("rolls back and returns 500 when the save fails", async () => {
    failFinalizeOnce();
    const res = await api("POST", "/evening-reports", {
      token: tokenA,
      body: { date: TODAY, medicationEffectiveness: 1 },
    });
    expect(res.status).toBe(500);

    const list = await api("GET", "/evening-reports", { token: tokenA });
    expect(list.body).toHaveLength(0);
  });
});

describe("PATCH /profile", () => {
  it("updates the caller's own profile", async () => {
    const res = await api("PATCH", "/profile", {
      token: tokenA,
      body: { preferredName: "Sam", bio: "Hello there" },
    });
    expect(res.status).toBe(200);
    expect((res.body as { preferredName: string }).preferredName).toBe("Sam");
  });

  it("only updates the caller's own profile, not another user's", async () => {
    const res = await api("PATCH", "/profile", {
      token: tokenA,
      body: { preferredName: "OnlyA", bio: "A's bio" },
    });
    expect(res.status).toBe(200);

    // User B's row must be untouched by A's update.
    const [rowB] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userBId));
    expect(rowB.preferredName).toBeNull();
    expect(rowB.bio).toBeNull();
  });

  it("rolls back field changes and returns 500 when the save fails", async () => {
    await api("PATCH", "/profile", {
      token: tokenA,
      body: { preferredName: "Original", bio: "first" },
    });

    failFinalizeOnce();
    const res = await api("PATCH", "/profile", {
      token: tokenA,
      body: { preferredName: "Should Not Stick", bio: "nope" },
    });
    expect(res.status).toBe(500);

    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userAId));
    expect(row.preferredName).toBe("Original");
    expect(row.bio).toBe("first");
  });
});
