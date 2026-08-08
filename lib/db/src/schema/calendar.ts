import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const calendarConnectionsTable = pgTable(
  "calendar_connections",
  {
    userId: varchar("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("google"),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("IDX_calendar_connections_provider").on(table.provider)],
);

export type CalendarConnection = typeof calendarConnectionsTable.$inferSelect;
