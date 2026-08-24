import { Router, type IRouter } from "express";
import { eq, and, sql, desc, gte, inArray } from "drizzle-orm";
import { db, morningLogsTable, eveningReportsTable, bodyScansTable, habitsTable, habitEntriesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/today", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const today = new Date().toISOString().split("T")[0];

  const [morningLog] = await db
    .select()
    .from(morningLogsTable)
    .where(and(eq(morningLogsTable.userId, userId), eq(morningLogsTable.date, today)))
    .limit(1);

  const [eveningReport] = await db
    .select()
    .from(eveningReportsTable)
    .where(and(eq(eveningReportsTable.userId, userId), eq(eveningReportsTable.date, today)))
    .limit(1);

  const scansToday = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bodyScansTable)
    .where(and(eq(bodyScansTable.userId, userId), sql`DATE(scanned_at) = ${today}::date`));

  const allHabits = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.userId, userId));

  const habitIds = allHabits.map((h) => h.id);
  const completedToday =
    habitIds.length > 0
      ? await db
          .select({ count: sql<number>`count(*)::int` })
          .from(habitEntriesTable)
          .where(
            and(
              eq(habitEntriesTable.date, today),
              eq(habitEntriesTable.completed, true),
              inArray(habitEntriesTable.habitId, habitIds)
            )
          )
      : [{ count: 0 }];

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

// Streak logic only looks back STREAK_LOOKBACK_DAYS; fetching older entries
// is waste and creates unbounded O(N habits × N entries) cost per request.
const STREAK_LOOKBACK_DAYS = 90;
const MAX_DASHBOARD_HABITS = 50;

router.get("/dashboard/streaks", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const habits = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.userId, userId))
    .limit(MAX_DASHBOARD_HABITS);

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - STREAK_LOOKBACK_DAYS);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const streaks = await Promise.all(
    habits.map(async (habit) => {
      const entries = await db
        .select()
        .from(habitEntriesTable)
        .where(
          and(
            eq(habitEntriesTable.habitId, habit.id),
            eq(habitEntriesTable.completed, true),
            gte(habitEntriesTable.date, cutoffStr)
          )
        )
        .orderBy(desc(habitEntriesTable.date))
        .limit(STREAK_LOOKBACK_DAYS);

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
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

router.get("/dashboard/mood-trend", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const today = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const startDate = days[0];
  const endDate = days[days.length - 1];

  const [morningLogs, bodyScans, eveningReports] = await Promise.all([
    db
      .select()
      .from(morningLogsTable)
      .where(
        and(
          eq(morningLogsTable.userId, userId),
          gte(morningLogsTable.date, startDate),
          sql`${morningLogsTable.date} <= ${endDate}`
        )
      ),
    db
      .select({
        date: sql<string>`DATE(${bodyScansTable.scannedAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(bodyScansTable)
      .where(
        and(
          eq(bodyScansTable.userId, userId),
          sql`DATE(${bodyScansTable.scannedAt}) >= ${startDate}::date`,
          sql`DATE(${bodyScansTable.scannedAt}) <= ${endDate}::date`
        )
      )
      .groupBy(sql`DATE(${bodyScansTable.scannedAt})`),
    db
      .select()
      .from(eveningReportsTable)
      .where(
        and(
          eq(eveningReportsTable.userId, userId),
          gte(eveningReportsTable.date, startDate),
          sql`${eveningReportsTable.date} <= ${endDate}`
        )
      ),
  ]);

  const morningLogMap = new Map(morningLogs.map((log) => [log.date, log]));
  const bodyScanMap = new Map(bodyScans.map((scan) => [scan.date, scan.count]));
  const eveningReportMap = new Map(eveningReports.map((report) => [report.date, report]));

  const results = days.map((ds) => {
    const morningLog = morningLogMap.get(ds);
    const scansCount = bodyScanMap.get(ds);
    const eveningReport = eveningReportMap.get(ds);

    return {
      date: ds,
      mentalLoadLevel: morningLog?.mentalLoadLevel ?? null,
      bodyScansCount: scansCount ?? 0,
      medicationEffectiveness: eveningReport?.medicationEffectiveness ?? null,
    };
  });

  res.json(results);
});

export default router;
