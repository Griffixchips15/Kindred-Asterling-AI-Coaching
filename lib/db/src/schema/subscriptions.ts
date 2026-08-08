import {
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// One row per user, caching the result of the most recent payment-provider
// subscription check. `status` is "active" when the user has a live
// subscription that grants access; everything else is no access.
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "past_due",
  "cancel_at_period_end",
  "cancelled",
  "expired",
]);

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    userId: varchar("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    email: varchar("email"),
    status: subscriptionStatusEnum("status").notNull().default("pending"),
    paymentCustomerId: varchar("payment_customer_id"),
    paymentSubscriptionId: varchar("payment_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    providerEventAt: timestamp("provider_event_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("subscriptions_payment_customer_id_unique").on(
      table.paymentCustomerId,
    ),
  ],
);

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type UpsertSubscription = typeof subscriptionsTable.$inferInsert;
