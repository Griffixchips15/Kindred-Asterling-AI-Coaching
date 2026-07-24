import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_DAILY_LIMIT = 100;

export function getDailyLimit(): number {
  return parseInt(process.env.DAILY_CHAT_LIMIT || "", 10) || DEFAULT_DAILY_LIMIT;
}

export async function checkAndIncrementDailyQuota(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = getDailyLimit();
  try {
    const result = await db.execute<{ count: number }>(
      sql`INSERT INTO daily_usage (user_id, date, count)
          VALUES (${userId}, CURRENT_DATE, 1)
          ON CONFLICT (user_id, date)
          DO UPDATE SET count = daily_usage.count + 1
          RETURNING count`,
    );
    const count = (result.rows?.[0] as any)?.count ?? 1;
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  } catch (err) {
    logger.error({ err, userId }, "Daily quota check failed — denying (fail closed)");
    return { allowed: false, remaining: 0 };
  }
}

export async function refundDailyQuota(userId: string): Promise<void> {
  try {
    await db.execute(
      sql`UPDATE daily_usage
          SET count = GREATEST(count - 1, 0)
          WHERE user_id = ${userId} AND date = CURRENT_DATE`,
    );
  } catch (err) {
    logger.error({ err, userId }, "Failed to refund daily quota");
  }
}
