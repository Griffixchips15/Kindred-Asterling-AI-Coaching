import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const eveningReportsTable = pgTable(
  "evening_reports",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    medicationEffectiveness: integer("medication_effectiveness").notNull(),
    overallMood: text("overall_mood"),
    wins: text("wins"),
    challenges: text("challenges"),
    tomorrowIntent: text("tomorrow_intent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("evening_reports_user_idx").on(table.userId)],
);

export const insertEveningReportSchema = createInsertSchema(
  eveningReportsTable,
).omit({ id: true, createdAt: true });
export type InsertEveningReport = z.infer<typeof insertEveningReportSchema>;
export type EveningReport = typeof eveningReportsTable.$inferSelect;
