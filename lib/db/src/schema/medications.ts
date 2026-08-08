import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const medicationsTable = pgTable(
  "medications",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dosage: text("dosage").notNull(),
    // One or more scheduled times per day, each "HH:MM" 24-hour.
    times: text("times").array().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("medications_user_idx").on(table.userId)],
);

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
    takenAt: timestamp("taken_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveness: integer("effectiveness"),
  },
  (t) => [
    uniqueIndex("medication_logs_user_med_date_time_unique").on(
      t.userId,
      t.medicationId,
      t.date,
      t.scheduledTime,
    ),
    index("medication_logs_user_idx").on(t.userId),
    index("medication_logs_med_idx").on(t.medicationId),
  ],
);

// Schedule history: each row is one scheduled time that was in effect for a
// medication over a date range. `endDate` NULL means still active. This lets the
// weekly report judge each past day against the schedule that was actually in
// effect that day, not whatever the current schedule is.
export const medicationScheduleEntriesTable = pgTable(
  "medication_schedule_entries",
  {
    id: serial("id").primaryKey(),
    medicationId: integer("medication_id")
      .notNull()
      .references(() => medicationsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // The scheduled dose time ("HH:MM", 24-hour).
    scheduledTime: text("scheduled_time").notNull(),
    // Inclusive first day this time was in effect.
    startDate: date("start_date").notNull(),
    // Exclusive last day (NULL = still active): active on day D iff
    // startDate <= D AND (endDate IS NULL OR D < endDate).
    endDate: date("end_date"),
  },
  (t) => [
    index("medication_schedule_entries_med_idx").on(t.medicationId),
    index("medication_schedule_entries_user_idx").on(t.userId),
  ],
);

export type Medication = typeof medicationsTable.$inferSelect;
export type MedicationLog = typeof medicationLogsTable.$inferSelect;
export type MedicationScheduleEntry =
  typeof medicationScheduleEntriesTable.$inferSelect;
