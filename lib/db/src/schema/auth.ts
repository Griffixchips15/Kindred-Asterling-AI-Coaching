import { date, index, jsonb, pgTable, text, timestamp, varchar } from "@drizzle-orm/pg-core";

export interface AuthSession {
  sid: string;
  sess: Record<string, unknown>;
  expire: Date;
}

export interface AuthUser {
  id: string;
  preferredName: string | null;
  birthday: Date | null;
  struggles: string | null;
  strengths: string | null;
  interests: string | null;
  bio: string | null;
  motivationalQuote: string | null;
  phone: string | null;
  timezone: string | null;
  onboardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// (IMPORTANT) This table is mandatory for authentication, don't drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// (IMPORTANT) This table is mandatory for authentication, don't drop it.
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
