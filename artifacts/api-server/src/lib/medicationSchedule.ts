import { and, eq, isNull } from "@workspace/db";
import { db, medicationScheduleEntriesTable } from "@workspace/db";

// A database executor: either the top-level `db` or a transaction handle. Used so
// schedule reconciliation can run inside the same transaction as the med write.
export type DbExecutor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Normalize a list of "HH:MM" times: trim, de-duplicate, and sort ascending.
export function normalizeTimes(times: string[]): string[] {
  return Array.from(new Set(times.map((t) => t.trim()))).sort();
}

// Reconcile schedule history for a medication against a new set of times,
// effective `today`. Times newly present open a fresh active entry; times no
// longer present have their open entry closed (end_date = today, exclusive) so
// they still count for days before today. Re-adding a time that was removed
// earlier today simply re-opens that same entry (no double-count).
export async function reconcileScheduleEntries(
  tx: DbExecutor,
  medicationId: number,
  userId: string,
  newTimes: string[],
  today: string,
): Promise<void> {
  const open = await tx
    .select()
    .from(medicationScheduleEntriesTable)
    .where(
      and(
        eq(medicationScheduleEntriesTable.medicationId, medicationId),
        eq(medicationScheduleEntriesTable.userId, userId),
        isNull(medicationScheduleEntriesTable.endDate),
      ),
    );
  const openByTime = new Map(open.map((e) => [e.scheduledTime, e]));
  const target = new Set(newTimes);

  // Close entries for times no longer scheduled.
  for (const entry of open) {
    if (!target.has(entry.scheduledTime)) {
      await tx
        .update(medicationScheduleEntriesTable)
        .set({ endDate: today })
        .where(
          and(
            eq(medicationScheduleEntriesTable.id, entry.id),
            eq(medicationScheduleEntriesTable.userId, userId),
          ),
        );
    }
  }

  // Open entries for newly scheduled times (or re-open one closed earlier today).
  for (const time of target) {
    if (openByTime.has(time)) continue;
    const [reopened] = await tx
      .update(medicationScheduleEntriesTable)
      .set({ endDate: null })
      .where(
        and(
          eq(medicationScheduleEntriesTable.medicationId, medicationId),
          eq(medicationScheduleEntriesTable.userId, userId),
          eq(medicationScheduleEntriesTable.scheduledTime, time),
          eq(medicationScheduleEntriesTable.endDate, today),
        ),
      )
      .returning();
    if (reopened) continue;
    await tx.insert(medicationScheduleEntriesTable).values({
      medicationId,
      userId,
      scheduledTime: time,
      startDate: today,
      endDate: null,
    });
  }
}
