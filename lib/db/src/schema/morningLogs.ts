import {
  pgTable,
  serial,
  text,
  date,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const morningLogsTable = pgTable(
  "morning_logs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    mentalLoadLevel: text("mental_load_level").notNull(),
    miniGoals: text("mini_goals").array().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("morning_logs_user_idx").on(table.userId)],
);

export const insertMorningLogSchema = createInsertSchema(morningLogsTable).omit(
  { id: true, createdAt: true },
);
export type InsertMorningLog = z.infer<typeof insertMorningLogSchema>;
export type MorningLog = typeof morningLogsTable.$inferSelect;
