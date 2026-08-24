import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  habitsTable,
  habitEntriesTable,
} from "@workspace/db";

const HABIT_ENTRY_LOOKBACK_DAYS = 90;
const MAX_HABITS = 50;
const TOOL_FIELD_SHORT = 200;
const TOOL_FIELD_LONG = 1000;

function clipStr(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) + "…" : t;
}

export async function getHabitsWithStreaks(userId: string): Promise<unknown> {
  const habits = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.userId, userId))
    .limit(MAX_HABITS);

  if (habits.length === 0) {
    return [];
  }

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - HABIT_ENTRY_LOOKBACK_DAYS);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const habitIds = habits.map(h => h.id);

  const allEntries = await db
    .select()
    .from(habitEntriesTable)
    .where(
      and(
        eq(habitEntriesTable.userId, userId),
        inArray(habitEntriesTable.habitId, habitIds),
        eq(habitEntriesTable.completed, true),
        gte(habitEntriesTable.date, cutoffStr),
      ),
    )
    .orderBy(desc(habitEntriesTable.date));

  // Group entries by habitId
  const entriesByHabit = new Map<number, typeof allEntries>();
  for (const entry of allEntries) {
    let entries = entriesByHabit.get(entry.habitId);
    if (!entries) {
      entries = [];
      entriesByHabit.set(entry.habitId, entries);
    }
    entries.push(entry);
  }

  return habits.map((habit) => {
    // Limit to HABIT_ENTRY_LOOKBACK_DAYS
    const entries = (entriesByHabit.get(habit.id) || []).slice(0, HABIT_ENTRY_LOOKBACK_DAYS);

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const completedDates = entries.map((e) => e.date);
    for (let i = 0; i < HABIT_ENTRY_LOOKBACK_DAYS; i++) {
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
      name: clipStr(habit.name, TOOL_FIELD_SHORT),
      description: clipStr(habit.description, TOOL_FIELD_LONG),
      targetDays: habit.targetDays,
      currentStreak,
      longestStreak,
      completedCount: entries.length,
    };
  });
}
