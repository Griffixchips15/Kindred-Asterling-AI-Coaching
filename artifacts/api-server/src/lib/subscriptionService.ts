import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import {
  getActiveSubscriptionByEmail,
  isSquareConfigured,
} from "./squareClient";
import { logger } from "./logger";

// Re-check Square at most this often per user. The cached row in the DB is the
// source of truth between checks; webhooks update it immediately on change.
const CHECK_TTL_MS = 5 * 60 * 1000;

export interface AccessStatus {
  active: boolean;
  status: string;
  currentPeriodEnd: string | null;
}

type SubscriptionRow = typeof subscriptionsTable.$inferSelect;

function bypassEmails(): Set<string> {
  return new Set(
    (process.env.SUBSCRIPTION_BYPASS_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function rowIsActive(row: SubscriptionRow | undefined): boolean {
  if (!row) return false;
  if (row.status !== "active") return false;
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() < Date.now()) {
    return false;
  }
  return true;
}

function toStatus(row: SubscriptionRow): AccessStatus {
  const active = rowIsActive(row);
  return {
    active,
    status: active ? "active" : row.status ?? "inactive",
    currentPeriodEnd: row.currentPeriodEnd
      ? row.currentPeriodEnd.toISOString()
      : null,
  };
}

const INACTIVE: AccessStatus = {
  active: false,
  status: "inactive",
  currentPeriodEnd: null,
};

// Resolve whether a user currently has access. Order: owner/allowlist bypass →
// (fail closed if Square unverifiable) → fresh cache → live Square check (which
// updates the cache). This is strictly fail-closed: if Square is unconfigured
// or a live check errors, access is denied rather than served from a stale
// cached "active" row. The only thing the cache grants is a recent (within TTL)
// successful verification.
export async function resolveSubscription(
  user: { id: string; email: string | null | undefined },
  opts: { forceRefresh?: boolean } = {},
): Promise<AccessStatus> {
  const email = (user.email || "").trim().toLowerCase();

  if (email && bypassEmails().has(email)) {
    return { active: true, status: "bypass", currentPeriodEnd: null };
  }

  // Fail closed: with no way to verify against Square, never grant access —
  // not even from a previously cached active row.
  if (!isSquareConfigured()) {
    logger.warn("Square not configured — denying access (fail closed)");
    return INACTIVE;
  }
  if (!email) {
    return INACTIVE;
  }

  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, user.id))
    .limit(1);

  const cacheFresh =
    row?.lastCheckedAt != null &&
    Date.now() - row.lastCheckedAt.getTime() < CHECK_TTL_MS;

  if (row && cacheFresh && !opts.forceRefresh) {
    return toStatus(row);
  }

  try {
    const result = await getActiveSubscriptionByEmail(email);
    const status = result.active ? "active" : "inactive";
    const values = {
      userId: user.id,
      email,
      status,
      squareCustomerId: result.squareCustomerId,
      squareSubscriptionId: result.squareSubscriptionId,
      currentPeriodEnd: result.currentPeriodEnd,
      lastCheckedAt: new Date(),
    };
    await db
      .insert(subscriptionsTable)
      .values(values)
      .onConflictDoUpdate({
        target: subscriptionsTable.userId,
        set: {
          email: values.email,
          status: values.status,
          squareCustomerId: values.squareCustomerId,
          squareSubscriptionId: values.squareSubscriptionId,
          currentPeriodEnd: values.currentPeriodEnd,
          lastCheckedAt: values.lastCheckedAt,
        },
      });
    return {
      active: result.active,
      status,
      currentPeriodEnd: result.currentPeriodEnd
        ? result.currentPeriodEnd.toISOString()
        : null,
    };
  } catch (err) {
    logger.error({ err }, "Square subscription check failed — denying access");
    // Fail closed: a Square error must not silently grant access from a stale
    // cached "active" row. A fresh successful check within the TTL is the only
    // thing that grants; otherwise the user must retry.
    return INACTIVE;
  }
}
