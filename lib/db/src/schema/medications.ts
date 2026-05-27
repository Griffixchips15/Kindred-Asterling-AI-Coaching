import { pgTable, serial, text, timestamp, varchar, integer, date } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const medicationsTable = pgTable("medications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  timeOfDay: text("time_of_day").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const medicationLogsTable = pgTable("medication_logs", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id")
    .notNull()
    .references(() => medicationsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Medication = typeof medicationsTable.$inferSelect;
export type MedicationLog = typeof medicationLogsTable.$inferSelect;
