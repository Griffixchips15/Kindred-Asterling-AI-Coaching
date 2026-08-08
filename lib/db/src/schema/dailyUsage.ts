import {
  pgTable,
  text,
  date,
  integer,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const dailyUsageTable = pgTable(
  "daily_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // standard postgres date
    count: integer("count").notNull().default(0),
  },
  (table) => [
    unique("daily_usage_user_date_unique").on(table.userId, table.date),
    index("daily_usage_user_idx").on(table.userId),
  ],
);
