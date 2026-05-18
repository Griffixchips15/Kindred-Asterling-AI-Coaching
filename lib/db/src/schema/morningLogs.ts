import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const morningLogsTable = pgTable("morning_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  mentalLoadLevel: text("mental_load_level").notNull(),
  miniGoals: text("mini_goals").array().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMorningLogSchema = createInsertSchema(morningLogsTable).omit({ id: true, createdAt: true });
export type InsertMorningLog = z.infer<typeof insertMorningLogSchema>;
export type MorningLog = typeof morningLogsTable.$inferSelect;
