import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const entitlementAuditTable = pgTable(
  "entitlement_audit",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    action: varchar("action").notNull(),
    actorId: varchar("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("entitlement_audit_user_idx").on(table.userId),
    index("entitlement_audit_actor_idx").on(table.actorId),
  ],
);

export type EntitlementAudit = typeof entitlementAuditTable.$inferSelect;
