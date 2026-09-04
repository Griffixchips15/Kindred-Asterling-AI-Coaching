import { getMongoDatabase } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_DAILY_LIMIT = 100;

export function getDailyLimit(): number {
  return (
    parseInt(process.env.DAILY_CHAT_LIMIT || "", 10) || DEFAULT_DAILY_LIMIT
  );
}

export async function checkAndIncrementDailyQuota(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = getDailyLimit();
  try {
    const date = new Date().toISOString().split("T")[0];
    const database = await getMongoDatabase();
    const usage = database.collection<{
      _id: string;
      userId: string;
      date: string;
      count: number;
    }>("daily_usage");
    await usage.updateOne(
      { _id: `${userId}:${date}` },
      { $setOnInsert: { userId, date, count: 0 } },
      { upsert: true },
    );
    const result = await usage.findOneAndUpdate(
      { _id: `${userId}:${date}`, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
    if (!result) return { allowed: false, remaining: 0 };
    const count = result.count;
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  } catch (err) {
    logger.error(
      { err, userId },
      "Daily quota check failed — denying (fail closed)",
    );
    return { allowed: false, remaining: 0 };
  }
}

export async function refundDailyQuota(userId: string): Promise<void> {
  try {
    const date = new Date().toISOString().split("T")[0];
    const database = await getMongoDatabase();
    await database
      .collection<any>("daily_usage")
      .updateOne(
        { _id: `${userId}:${date}`, count: { $gt: 0 } },
        { $inc: { count: -1 } },
      );
  } catch (err) {
    logger.error({ err, userId }, "Failed to refund daily quota");
  }
}
