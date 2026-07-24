import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const betaGrantsTable = pgTable("beta_grants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  grantedBy: varchar("granted_by")
    .notNull()
    .references(() => usersTable.id),
  grantedAt: timestamp("granted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: varchar("revoked_by").references(() => usersTable.id),
});

export type BetaGrant = typeof betaGrantsTable.$inferSelect;
