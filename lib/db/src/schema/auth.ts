import { date, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Application-owned data keyed by the authoritative Clerk user ID.
export const usersTable = pgTable("users", {
  // The sole identity mapping: this primary key is the Clerk user ID.
  id: varchar("id").primaryKey(),
  preferredName: varchar("preferred_name"),
  birthday: date("birthday"),
  struggles: text("struggles"),
  strengths: text("strengths"),
  interests: text("interests"),
  bio: text("bio"),
  motivationalQuote: text("motivational_quote"),
  phone: varchar("phone"),
  timezone: varchar("timezone"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
