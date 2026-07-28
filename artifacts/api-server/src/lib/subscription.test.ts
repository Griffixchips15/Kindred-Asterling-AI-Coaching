import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { db, usersTable, subscriptionsTable, betaGrantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

import { resolveSubscription } from "./subscriptionService";

const suffix = Math.random().toString(36).slice(2, 10);
const ownerId = `owner-${suffix}`;
const betaUserId = `beta-${suffix}`;
const helcimUserId = `helcim-${suffix}`;
const inactiveUserId = `inactive-${suffix}`;
const email = `sub-${suffix}@example.test`;

beforeAll(async () => {
  for (const id of [ownerId, betaUserId, helcimUserId, inactiveUserId]) {
    await db.insert(usersTable).values({ id, email, emailVerifiedAt: new Date() }).onConflictDoNothing();
  }
});

afterAll(async () => {
  for (const id of [ownerId, betaUserId, helcimUserId, inactiveUserId]) {
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
});

beforeEach(async () => {
  vi.restoreAllMocks();
  delete process.env.SUBSCRIPTION_OWNER_IDS;
  await db.delete(betaGrantsTable);
  await db.delete(subscriptionsTable);
});

describe("resolveSubscription", () => {
  it("grants owner access by immutable user ID without any DB rows", async () => {
    process.env.SUBSCRIPTION_OWNER_IDS = ownerId;
    const status = await resolveSubscription({ id: ownerId, email });
    expect(status.active).toBe(true);
    expect(status.source).toBe("owner");
  });

  it("grants beta access when user has an active, unexpired beta grant", async () => {
    await db.insert(betaGrantsTable).values({
      userId: betaUserId,
      grantedBy: ownerId,
    });
    const status = await resolveSubscription({ id: betaUserId, email });
    expect(status.active).toBe(true);
    expect(status.source).toBe("beta");
  });

  it("denies beta access when beta grant is revoked", async () => {
    await db.insert(betaGrantsTable).values({
      userId: betaUserId,
      grantedBy: ownerId,
      revokedAt: new Date(),
      revokedBy: ownerId,
    });
    const status = await resolveSubscription({ id: betaUserId, email });
    expect(status.active).toBe(false);
    expect(status.source).toBe("none");
  });

  it("denies beta access when beta grant has expired", async () => {
    await db.insert(betaGrantsTable).values({
      userId: betaUserId,
      grantedBy: ownerId,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const status = await resolveSubscription({ id: betaUserId, email });
    expect(status.active).toBe(false);
    expect(status.source).toBe("none");
  });

  it("grants access from an active cached Helcim subscription row", async () => {
    await db.insert(subscriptionsTable).values({
      userId: helcimUserId,
      email,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastCheckedAt: new Date(),
    });
    const status = await resolveSubscription({ id: helcimUserId, email });
    expect(status.active).toBe(true);
    expect(status.source).toBe("helcim");
  });

  it("denies access for expired subscription period", async () => {
    await db.insert(subscriptionsTable).values({
      userId: helcimUserId,
      email,
      status: "active",
      currentPeriodEnd: new Date(Date.now() - 60 * 60 * 1000),
      lastCheckedAt: new Date(),
    });
    const status = await resolveSubscription({ id: helcimUserId, email });
    expect(status.active).toBe(false);
    expect(status.source).toBe("none");
  });

  it("denies access when no owner, beta grant, or Helcim row exists", async () => {
    const status = await resolveSubscription({ id: inactiveUserId, email });
    expect(status.active).toBe(false);
    expect(status.source).toBe("none");
  });

  it("serves cached Helcim result within the TTL", async () => {
    await db.insert(subscriptionsTable).values({
      userId: helcimUserId,
      email,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastCheckedAt: new Date(),
    });
    const status = await resolveSubscription({ id: helcimUserId, email });
    expect(status.active).toBe(true);

    // Second call within TTL should still be active
    const cached = await resolveSubscription({ id: helcimUserId, email });
    expect(cached.active).toBe(true);
  });

  it("denies access when no payment provider configured", async () => {
    // isHelcimConfigured() returns false when HELCIM_API_KEY is unset
    const origKey = process.env.HELCIM_API_KEY;
    delete process.env.HELCIM_API_KEY;
    const status = await resolveSubscription({ id: inactiveUserId, email });
    expect(status.active).toBe(false);
    expect(status.source).toBe("none");
    if (origKey) process.env.HELCIM_API_KEY = origKey;
  });
});
