import { pgTable, serial, text, timestamp, varchar, integer, date, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const medicationsTable = pgTable("medications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  // One or more scheduled times per day, each "HH:MM" 24-hour.
  times: text("times").array().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const medicationLogsTable = pgTable(
  "medication_logs",
  {
    id: serial("id").primaryKey(),
    medicationId: integer("medication_id")
      .notNull()
      .references(() => medicationsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // Which scheduled dose this log is for ("HH:MM"); one log per dose per day.
    scheduledTime: text("scheduled_time").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).defaultNow().notNull(),
    effectiveness: integer("effectiveness"),
  },
  (t) => [
    uniqueIndex("medication_logs_user_med_date_time_unique").on(
      t.userId,
      t.medicationId,
      t.date,
      t.scheduledTime,
    ),
  ],
);

export type Medication = typeof medicationsTable.$inferSelect;
export type MedicationLog = typeof medicationLogsTable.$inferSelect;
