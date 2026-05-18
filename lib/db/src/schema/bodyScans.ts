import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bodyScansTable = pgTable("body_scans", {
  id: serial("id").primaryKey(),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  feelings: text("feelings").array().notNull().default([]),
  energyLevel: integer("energy_level").notNull(),
  physicalSensations: text("physical_sensations"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBodyScanSchema = createInsertSchema(bodyScansTable).omit({ id: true, createdAt: true });
export type InsertBodyScan = z.infer<typeof insertBodyScanSchema>;
export type BodyScan = typeof bodyScansTable.$inferSelect;
