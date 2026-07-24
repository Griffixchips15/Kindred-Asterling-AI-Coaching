import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const entitlementAuditTable = pgTable("entitlement_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  action: varchar("action").notNull(),
  actorId: varchar("actor_id").references(() => usersTable.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EntitlementAudit = typeof entitlementAuditTable.$inferSelect;
