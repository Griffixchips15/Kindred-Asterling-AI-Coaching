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
  conversations,
  messages,
} from "@workspace/db";
import app from "../app";
import { createSession, deleteSession } from "./auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// These tests drive the real Express chat routes over HTTP (auth middleware,
// request validation, status codes, conversation/message ownership checks, and
// response shapes). Chat history is the most sensitive class of user data, so we
// prove anonymous callers are rejected, one user can't read another's archived
// conversation, and a failed LLM turn never persists a fallback assistant reply
// that would pollute the conversation. The outbound Anthropic call is mocked so
// the suite makes no real LLM calls and incurs no token cost.
vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}));

const createMock = vi.mocked(anthropic.messages.create);

function mockReplyOnce(text: string) {
  createMock.mockResolvedValueOnce({
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    // The route only reads stop_reason + content; the rest of the SDK shape is
    // irrelevant for these tests.
  } as unknown as Awaited<ReturnType<typeof anthropic.messages.create>>);
}

function failReplyOnce() {
  createMock.mockRejectedValueOnce(new Error("anthropic boom"));
}

const suffix = Math.random().toString(36).slice(2, 10);
const userAId = `test-chathttp-a-${suffix}`;
const userBId = `test-chathttp-b-${suffix}`;

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

interface ConvWithMessages {
  id: number;
  messages: { role: string; content: string }[];
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
  createMock.mockReset();
  for (const id of [userAId, userBId]) {
    // Cascade removes messages owned by the user's conversations.
    await db.delete(conversations).where(eq(conversations.userId, id));
  }
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
    { method: "GET", path: "/chat/active" },
    { method: "POST", path: "/chat/send", body: { content: "hello" } },
    {
      method: "POST",
      path: "/chat/append",
      body: { role: "user", content: "hello" },
    },
    { method: "POST", path: "/chat/archive" },
    { method: "GET", path: "/chat/archived" },
    { method: "GET", path: "/chat/archived/1" },
  ];

  it.each(anonymousCases)(
    "rejects anonymous $method $path with 401",
    async ({ method, path, body }) => {
      const res = await api(method, path, { body });
      expect(res.status).toBe(401);
      // A rejected request must never reach the LLM.
      expect(createMock).not.toHaveBeenCalled();
    },
  );
});

describe("GET /chat/active", () => {
  it("returns an active conversation for the owner", async () => {
    const res = await api("GET", "/chat/active", { token: tokenA });
    expect(res.status).toBe(200);
    const conv = res.body as ConvWithMessages;
    expect(conv.id).toBeTypeOf("number");
    expect(Array.isArray(conv.messages)).toBe(true);

    // It belongs to the caller in the DB.
    const [row] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv.id));
    expect(row.userId).toBe(userAId);
  });

  it("gives each user their own conversation, never a shared one", async () => {
    const a = (await api("GET", "/chat/active", { token: tokenA }))
      .body as ConvWithMessages;
    const b = (await api("GET", "/chat/active", { token: tokenB }))
      .body as ConvWithMessages;
    expect(a.id).not.toBe(b.id);

    const [rowB] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, b.id));
    expect(rowB.userId).toBe(userBId);
  });
});

describe("POST /chat/send", () => {
  it("persists the user turn and the assistant reply for the owner", async () => {
    mockReplyOnce("Take your time at therapy.");
    const res = await api("POST", "/chat/send", {
      token: tokenA,
      body: { content: "heading to therapy" },
    });
    expect(res.status).toBe(200);

    const conv = res.body as ConvWithMessages;
    const roles = conv.messages.map((m) => m.role);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
    expect(conv.messages.some((m) => m.content === "heading to therapy")).toBe(
      true,
    );
    expect(
      conv.messages.some((m) => m.content === "Take your time at therapy."),
    ).toBe(true);
  });

  it("rejects an invalid body with 400 and never calls the model", async () => {
    const res = await api("POST", "/chat/send", {
      token: tokenA,
      body: { content: "" },
    });
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();

    const rows = await db
      .select()
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userAId));
    expect(rows).toHaveLength(0);
  });

  it("returns 502 and persists no fallback assistant reply when the model call fails", async () => {
    failReplyOnce();
    const res = await api("POST", "/chat/send", {
      token: tokenA,
      body: { content: "are you there" },
    });
    expect(res.status).toBe(502);

    // The user turn is stored, but no assistant turn is — a failed LLM call
    // must never pollute history with a fabricated reply.
    const rows = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userAId));
    expect(rows.filter((r) => r.role === "assistant")).toHaveLength(0);
    expect(rows.filter((r) => r.role === "user")).toHaveLength(1);
  });
});

describe("POST /chat/append", () => {
  it("appends a message to the caller's own conversation", async () => {
    const res = await api("POST", "/chat/append", {
      token: tokenA,
      body: { role: "user", content: "a quick note" },
    });
    expect(res.status).toBe(200);
    const conv = res.body as ConvWithMessages;
    expect(conv.messages.some((m) => m.content === "a quick note")).toBe(true);

    // It landed under a conversation owned by the caller.
    const [row] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv.id));
    expect(row.userId).toBe(userAId);
  });
});

describe("GET /chat/archived/:id ownership", () => {
  async function archivedConvIdFor(token: string): Promise<number> {
    // Archiving the current active conversation moves it to the archived list.
    await api("POST", "/chat/archive", { token });
    const list = (await api("GET", "/chat/archived", { token })).body as {
      id: number;
    }[];
    return list[0].id;
  }

  it("lets the owner read their archived conversation", async () => {
    const id = await archivedConvIdFor(tokenA);
    const res = await api("GET", `/chat/archived/${id}`, { token: tokenA });
    expect(res.status).toBe(200);
    expect((res.body as ConvWithMessages).id).toBe(id);
  });

  it("returns 404 when another user tries to read your archived conversation", async () => {
    const id = await archivedConvIdFor(tokenA);
    const res = await api("GET", `/chat/archived/${id}`, { token: tokenB });
    expect(res.status).toBe(404);
  });

  it("does not leak one user's archived conversations into another's list", async () => {
    await archivedConvIdFor(tokenA);
    const list = await api("GET", "/chat/archived", { token: tokenB });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });
});
