import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  boolean,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const habitsTable = pgTable(
  "habits",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    targetDays: integer("target_days").notNull().default(90),
    startDate: date("start_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("habits_user_idx").on(table.userId)],
);

export const habitEntriesTable = pgTable(
  "habit_entries",
  {
    id: serial("id").primaryKey(),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habitsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    completed: boolean("completed").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("habit_entries_user_idx").on(table.userId),
    index("habit_entries_habit_idx").on(table.habitId),
  ],
);

export const insertHabitSchema = createInsertSchema(habitsTable).omit({
  id: true,
  createdAt: true,
});
export const insertHabitEntrySchema = createInsertSchema(
  habitEntriesTable,
).omit({ id: true, createdAt: true });

export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;
export type InsertHabitEntry = z.infer<typeof insertHabitEntrySchema>;
export type HabitEntry = typeof habitEntriesTable.$inferSelect;
