import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, usersTable, subscriptionsTable } from "@workspace/db";

// The service's only external dependency is the Square REST client, which we
// stub so the tests exercise the access-resolution + caching logic without
// network calls.
vi.mock("./squareClient", () => ({
  isSquareConfigured: vi.fn(() => true),
  getActiveSubscriptionByEmail: vi.fn(),
}));

import * as square from "./squareClient";
import { resolveSubscription } from "./subscriptionService";

const mockIsConfigured = vi.mocked(square.isSquareConfigured);
const mockGetActive = vi.mocked(square.getActiveSubscriptionByEmail);

const suffix = Math.random().toString(36).slice(2, 10);
const userId = `test-sub-${suffix}`;
const email = `sub-${suffix}@example.test`;
const user = { id: userId, email };

function activeResult(periodEnd: Date | null = null) {
  return {
    active: true,
    squareCustomerId: "cust_1",
    squareSubscriptionId: "sub_1",
    currentPeriodEnd: periodEnd,
  };
}

function inactiveResult() {
  return {
    active: false,
    squareCustomerId: null,
    squareSubscriptionId: null,
    currentPeriodEnd: null,
  };
}

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({ id: userId, email })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
});

beforeEach(async () => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  delete process.env.SUBSCRIPTION_BYPASS_EMAILS;
  await db
    .delete(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
});

afterEach(() => {
  delete process.env.SUBSCRIPTION_BYPASS_EMAILS;
});

describe("resolveSubscription", () => {
  it("grants access for allowlisted (bypass) emails without calling Square", async () => {
    process.env.SUBSCRIPTION_BYPASS_EMAILS = `someone@else.test, ${email.toUpperCase()}`;
    const status = await resolveSubscription(user);
    expect(status.active).toBe(true);
    expect(status.status).toBe("bypass");
    expect(mockGetActive).not.toHaveBeenCalled();
  });

  it("grants access and caches the row when Square reports an active subscription", async () => {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockGetActive.mockResolvedValue(activeResult(periodEnd));

    const status = await resolveSubscription(user);
    expect(status.active).toBe(true);
    expect(status.status).toBe("active");
    expect(mockGetActive).toHaveBeenCalledTimes(1);

    const [row] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));
    expect(row?.status).toBe("active");
    expect(row?.squareSubscriptionId).toBe("sub_1");
  });

  it("denies access when Square reports no active subscription", async () => {
    mockGetActive.mockResolvedValue(inactiveResult());
    const status = await resolveSubscription(user);
    expect(status.active).toBe(false);
    expect(status.status).toBe("inactive");
  });

  it("serves the cached result within the TTL without re-querying Square", async () => {
    mockGetActive.mockResolvedValue(activeResult());
    await resolveSubscription(user, { forceRefresh: true });
    expect(mockGetActive).toHaveBeenCalledTimes(1);

    // Second call (no force) should hit the fresh cache, not Square.
    const status = await resolveSubscription(user);
    expect(status.active).toBe(true);
    expect(mockGetActive).toHaveBeenCalledTimes(1);
  });

  it("re-queries Square when forceRefresh is set", async () => {
    mockGetActive.mockResolvedValue(activeResult());
    await resolveSubscription(user, { forceRefresh: true });
    await resolveSubscription(user, { forceRefresh: true });
    expect(mockGetActive).toHaveBeenCalledTimes(2);
  });

  it("never grants access when Square is not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    const status = await resolveSubscription(user, { forceRefresh: true });
    expect(status.active).toBe(false);
    expect(mockGetActive).not.toHaveBeenCalled();
  });

  it("fails closed: a cached active row is NOT served when Square becomes unconfigured", async () => {
    // Seed an active cached row via a successful live check.
    mockGetActive.mockResolvedValue(activeResult());
    const granted = await resolveSubscription(user, { forceRefresh: true });
    expect(granted.active).toBe(true);

    // Square goes unconfigured — access must be denied despite the cached row.
    mockIsConfigured.mockReturnValue(false);
    const denied = await resolveSubscription(user, { forceRefresh: true });
    expect(denied.active).toBe(false);
  });

  it("fails closed: a Square error denies access even with a cached active row", async () => {
    // Seed an active cached row.
    mockGetActive.mockResolvedValue(activeResult());
    const granted = await resolveSubscription(user, { forceRefresh: true });
    expect(granted.active).toBe(true);

    // Live check errors on a forced refresh — must deny, not serve stale cache.
    mockGetActive.mockRejectedValue(new Error("square down"));
    const denied = await resolveSubscription(user, { forceRefresh: true });
    expect(denied.active).toBe(false);
  });

  it("treats an expired cached period as inactive", async () => {
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000);
    mockGetActive.mockResolvedValue(activeResult(pastEnd));
    const status = await resolveSubscription(user, { forceRefresh: true });
    // Square said active, but the charged-through date is in the past → the
    // cached row reads as inactive on the next (cached) resolve.
    expect(status.active).toBe(true); // live result reflects Square's say-so
    const cached = await resolveSubscription(user);
    expect(cached.active).toBe(false);
  });
});
