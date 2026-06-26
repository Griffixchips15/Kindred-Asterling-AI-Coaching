import { boolean, date, index, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// One row per user holding their reminder preferences. Times are stored as
// "HH:MM" strings interpreted in the user's own timezone (usersTable.timezone).
export const reminderSettingsTable = pgTable("reminder_settings", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  morningEnabled: boolean("morning_enabled").notNull().default(false),
  morningTime: text("morning_time").notNull().default("08:00"),
  medicationEnabled: boolean("medication_enabled").notNull().default(false),
  eveningEnabled: boolean("evening_enabled").notNull().default(false),
  eveningTime: text("evening_time").notNull().default("21:00"),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ReminderSettings = typeof reminderSettingsTable.$inferSelect;
export type UpsertReminderSettings = typeof reminderSettingsTable.$inferInsert;

// Idempotency ledger: one row per reminder actually sent. The unique index
// guarantees a given user+type+local date+dose time+channel fires at most once,
// so the scheduler is safe to run repeatedly. doseTime defaults to "" (not NULL)
// so the unique index dedups correctly (NULLs are never equal in Postgres).
export const reminderDeliveriesTable = pgTable(
  "reminder_deliveries",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    doseTime: text("dose_time").notNull().default(""),
    localDate: date("local_date").notNull(),
    channel: text("channel").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reminder_deliveries_unique").on(
      table.userId,
      table.type,
      table.localDate,
      table.doseTime,
      table.channel,
    ),
    index("reminder_deliveries_user_idx").on(table.userId),
  ],
);

export type ReminderDelivery = typeof reminderDeliveriesTable.$inferSelect;
