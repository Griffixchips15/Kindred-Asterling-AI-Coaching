import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const processedWebhooksTable = pgTable("processed_webhooks", {
  webhookId: varchar("webhook_id").primaryKey(),
  eventType: varchar("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProcessedWebhook = typeof processedWebhooksTable.$inferSelect;
