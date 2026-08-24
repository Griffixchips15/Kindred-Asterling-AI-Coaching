import { db, habitsTable, habitEntriesTable, usersTable } from "@workspace/db";
import { runChatTool } from "../artifacts/api-server/src/lib/chatTools";
import { eq } from "drizzle-orm";

async function runBench() {
  const userId = "bench-user-" + Math.random().toString(36).substring(7);

  await db.insert(usersTable).values({ id: userId });

  const habitIds = [];
  for (let i = 0; i < 50; i++) {
    const res = await db.insert(habitsTable).values({
      userId,
      name: `Habit ${i}`,
      startDate: new Date().toISOString().split("T")[0],
      targetDays: 90
    }).returning({ id: habitsTable.id });
    habitIds.push(res[0].id);
  }

  const today = new Date();
  for (const habitId of habitIds) {
    const entries = [];
    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      entries.push({
        userId,
        habitId,
        date: d.toISOString().split("T")[0],
        completed: Math.random() > 0.5
      });
    }
    await db.insert(habitEntriesTable).values(entries);
  }

  // warm up db
  await runChatTool("get_habits_with_streaks", {}, userId);
  await runChatTool("get_habits_with_streaks", {}, userId);

  let totalOriginalTime = 0;
  for (let i = 0; i < 10; i++) {
    const startOriginal = performance.now();
    await runChatTool("get_habits_with_streaks", {}, userId);
    const endOriginal = performance.now();
    totalOriginalTime += (endOriginal - startOriginal);
  }

  console.log(`Original average time over 10 runs: ${totalOriginalTime / 10}ms`);

  await db.delete(usersTable).where(eq(usersTable.id, userId));
}
runBench().catch(console.error);
