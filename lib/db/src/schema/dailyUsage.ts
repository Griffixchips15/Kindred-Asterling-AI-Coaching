import { pgTable, text, date, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const dailyUsageTable = pgTable(
  "daily_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date").notNull(), // standard postgres date
    count: integer("count").notNull().default(0),
  },
  (table) => ({
    userDateUnique: unique().on(table.userId, table.date),
  }),
);
