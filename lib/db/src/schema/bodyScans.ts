import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const bodyScansTable = pgTable(
  "body_scans",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
    feelings: text("feelings").array().notNull().default([]),
    energyLevel: integer("energy_level").notNull(),
    physicalSensations: text("physical_sensations"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("body_scans_user_idx").on(table.userId)],
);

export const insertBodyScanSchema = createInsertSchema(bodyScansTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBodyScan = z.infer<typeof insertBodyScanSchema>;
export type BodyScan = typeof bodyScansTable.$inferSelect;
