import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

// The checkout route's only external dependency is the Stripe REST client, which
// we stub so the test exercises the real Express route (auth, body validation,
// 503-when-unconfigured, success shape) without any network call or token cost.
vi.mock("./stripeClient", () => ({
  isStripeConfigured: vi.fn(() => true),
  isCheckoutConfigured: vi.fn(() => true),
  createSubscriptionCheckoutSession: vi.fn(),
  getActiveSubscriptionByEmail: vi.fn(),
  getCustomerEmail: vi.fn(),
  verifyWebhookSignature: vi.fn(() => true),
}));

import app from "../app";
import { createSession, deleteSession } from "./auth";
import * as stripe from "./stripeClient";

const mockIsCheckoutConfigured = vi.mocked(stripe.isCheckoutConfigured);
const mockCreateSession = vi.mocked(stripe.createSubscriptionCheckoutSession);

const suffix = Math.random().toString(36).slice(2, 10);
const userId = `test-checkout-${suffix}`;
const email = `${userId}@example.test`;

let server: Server;
let baseUrl: string;
let token: string;
const sids: string[] = [];

async function makeSession(uid: string): Promise<string> {
  const sid = await createSession({
    user: {
      id: uid,
      email: `${uid}@example.test`,
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

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({ id: userId, email })
    .onConflictDoNothing();
  token = await makeSession(userId);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  for (const sid of sids) await deleteSession(sid);
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCheckoutConfigured.mockReturnValue(true);
});

describe("POST /api/subscription/checkout", () => {
  it("rejects anonymous callers with 401 and never calls Stripe", async () => {
    const res = await api("POST", "/api/subscription/checkout", {
      body: { planType: "yearly" },
    });
    expect(res.status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects an invalid planType with 400", async () => {
    const res = await api("POST", "/api/subscription/checkout", {
      token,
      body: { planType: "monthly" },
    });
    expect(res.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("returns 503 when checkout is not configured", async () => {
    mockIsCheckoutConfigured.mockReturnValue(false);
    const res = await api("POST", "/api/subscription/checkout", {
      token,
      body: { planType: "yearly" },
    });
    expect(res.status).toBe(503);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("returns the Stripe checkout URL for an authenticated buyer", async () => {
    mockCreateSession.mockResolvedValue({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    const res = await api("POST", "/api/subscription/checkout", {
      token,
      body: { planType: "lifetime" },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    // Identity comes from the session, not the request body.
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockCreateSession.mock.calls[0]![0]).toMatchObject({
      planType: "lifetime",
      buyerEmail: email,
    });
  });

  it("returns 502 when the Stripe call fails", async () => {
    mockCreateSession.mockRejectedValue(new Error("stripe down"));
    const res = await api("POST", "/api/subscription/checkout", {
      token,
      body: { planType: "yearly" },
    });
    expect(res.status).toBe(502);
  });
});
