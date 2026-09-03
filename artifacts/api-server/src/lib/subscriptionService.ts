import { eq, and, gt, isNull, or } from "@workspace/db";
import {
  db,
  subscriptionsTable,
  betaGrantsTable,
  entitlementAuditTable,
} from "@workspace/db";
import { isHelcimConfigured } from "./helcimClient";
import { logger } from "./logger";

const CHECK_TTL_MS = 5 * 60 * 1000;

export type AccessSource = "owner" | "beta" | "helcim" | "none";

export interface AccessStatus {
  active: boolean;
  status: string;
  currentPeriodEnd: string | null;
  source: AccessSource;
}

type SubscriptionRow = typeof subscriptionsTable.$inferSelect;

export function ownerIds(): Set<string> {
  return new Set(
    (process.env.SUBSCRIPTION_OWNER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function ownerEmails(): Set<string> {
  return new Set(
    (process.env.SUBSCRIPTION_OWNER_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  );
}

function rowIsActive(row: SubscriptionRow | undefined): boolean {
  if (!row) return false;
  if (row.status !== "active" && row.status !== "cancel_at_period_end")
    return false;
  // A cancellation only grants access when Helcim supplied an authoritative end.
  if (row.status === "cancel_at_period_end" && !row.currentPeriodEnd)
    return false;
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() < Date.now()) {
    return false;
  }
  return true;
}

const INACTIVE: AccessStatus = {
  active: false,
  status: "inactive",
  currentPeriodEnd: null,
  source: "none",
};

async function audit(
  userId: string,
  action: string,
  actorId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db
      .insert(entitlementAuditTable)
      .values({ userId, action, actorId, metadata: metadata ?? null });
  } catch (err) {
    logger.error(
      { err, userId, action },
      "Failed to write entitlement audit log",
    );
  }
}

export async function resolveSubscription(
  user: { id: string; email: string | null | undefined },
  opts: { forceRefresh?: boolean } = {},
): Promise<AccessStatus> {
  // Owner access — immutable user ID bypass
  if (ownerIds().has(user.id)) {
    return {
      active: true,
      status: "active",
      currentPeriodEnd: null,
      source: "owner",
    };
  }

  // Owner email bypass (temporary — for bootstrapping before user ID is known)
  if (user.email && ownerEmails().has(user.email.trim().toLowerCase())) {
    return {
      active: true,
      status: "active",
      currentPeriodEnd: null,
      source: "owner",
    };
  }

  // Beta grant check
  const [betaGrant] = await db
    .select()
    .from(betaGrantsTable)
    .where(
      and(
        eq(betaGrantsTable.userId, user.id),
        isNull(betaGrantsTable.revokedAt),
        or(
          isNull(betaGrantsTable.expiresAt),
          gt(betaGrantsTable.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  if (betaGrant) {
    return {
      active: true,
      status: "active",
      currentPeriodEnd: null,
      source: "beta",
    };
  }

  // Payment provider check
  const paymentConfigured = isHelcimConfigured();
  if (!paymentConfigured) {
    logger.warn(
      "No payment provider configured — denying access (fail closed)",
    );
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
    const active = rowIsActive(row);
    return {
      active,
      status: active ? "active" : (row.status ?? "inactive"),
      currentPeriodEnd: row.currentPeriodEnd
        ? row.currentPeriodEnd.toISOString()
        : null,
      source: active ? "helcim" : "none",
    };
  }

  // If no cached row or cache expired, rely on webhook-updated cache
  if (row) {
    const active = rowIsActive(row);
    return {
      active,
      status: active ? "active" : (row.status ?? "inactive"),
      currentPeriodEnd: row.currentPeriodEnd
        ? row.currentPeriodEnd.toISOString()
        : null,
      source: active ? "helcim" : "none",
    };
  }

  return INACTIVE;
}
