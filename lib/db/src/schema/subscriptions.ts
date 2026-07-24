import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// One row per user, caching the result of the most recent payment-provider
// subscription check. `status` is "active" when the user has a live
// subscription that grants access; everything else is no access.
export const subscriptionsTable = pgTable("subscriptions", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  email: varchar("email"),
  status: varchar("status").notNull().default("inactive"),
  paymentCustomerId: varchar("payment_customer_id"),
  paymentSubscriptionId: varchar("payment_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type UpsertSubscription = typeof subscriptionsTable.$inferInsert;
