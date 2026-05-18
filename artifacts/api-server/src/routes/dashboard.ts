import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, morningLogsTable, eveningReportsTable, bodyScansTable, habitsTable, habitEntriesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/today", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const [morningLog] = await db
    .select()
    .from(morningLogsTable)
    .where(eq(morningLogsTable.date, today))
    .limit(1);

  const [eveningReport] = await db
    .select()
    .from(eveningReportsTable)
    .where(eq(eveningReportsTable.date, today))
    .limit(1);

  const scansToday = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bodyScansTable)
    .where(sql`DATE(scanned_at) = ${today}::date`);

  const allHabits = await db.select().from(habitsTable);

  const completedToday = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(habitEntriesTable)
    .where(
      and(
        eq(habitEntriesTable.date, today),
        eq(habitEntriesTable.completed, true)
      )
    );

  res.json({
    date: today,
    morningDone: !!morningLog,
    eveningDone: !!eveningReport,
    bodyScansCount: scansToday[0]?.count ?? 0,
    habitsCompletedToday: completedToday[0]?.count ?? 0,
    totalHabits: allHabits.length,
    currentMentalLoad: morningLog?.mentalLoadLevel ?? null,
  });
});

router.get("/dashboard/streaks", async (_req, res): Promise<void> => {
  const habits = await db.select().from(habitsTable);

  const streaks = await Promise.all(
    habits.map(async (habit) => {
      const entries = await db
        .select()
        .from(habitEntriesTable)
        .where(
          and(
            eq(habitEntriesTable.habitId, habit.id),
            eq(habitEntriesTable.completed, true)
          )
        )
        .orderBy(desc(habitEntriesTable.date));

      // Calculate current streak
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      const today = new Date();

      const completedDates = entries.map((e) => e.date);

      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        if (completedDates.includes(ds)) {
          if (i === 0 || currentStreak > 0) currentStreak++;
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          if (i > 0 && currentStreak > 0) break;
          tempStreak = 0;
        }
      }

      return {
        habitId: habit.id,
        habitName: habit.name,
        currentStreak,
        longestStreak,
        completedCount: entries.length,
        targetDays: habit.targetDays,
      };
    })
  );

  res.json(streaks);
});

router.get("/dashboard/mood-trend", async (_req, res): Promise<void> => {
  const results = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];

    const [morningLog] = await db
      .select()
      .from(morningLogsTable)
      .where(eq(morningLogsTable.date, ds))
      .limit(1);

    const [{ count: scansCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bodyScansTable)
      .where(sql`DATE(scanned_at) = ${ds}::date`);

    const [eveningReport] = await db
      .select()
      .from(eveningReportsTable)
      .where(eq(eveningReportsTable.date, ds))
      .limit(1);

    results.push({
      date: ds,
      mentalLoadLevel: morningLog?.mentalLoadLevel ?? null,
      bodyScansCount: scansCount ?? 0,
      medicationEffectiveness: eveningReport?.medicationEffectiveness ?? null,
    });
  }

  res.json(results);
});

export default router;
