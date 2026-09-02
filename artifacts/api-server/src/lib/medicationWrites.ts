import { and, eq } from "@workspace/db";
import {
  db,
  medicationsTable,
  medicationLogsTable,
  type Medication,
  type MedicationLog,
} from "@workspace/db";
import { normalizeTimes, reconcileScheduleEntries } from "./medicationSchedule";

// Data the create/update paths accept, already trimmed/normalized by the caller.
export interface MedicationWriteData {
  name: string;
  dosage: string;
  times: string[];
  notes: string | null;
}

// Create a medication and open its schedule-history entries inside one
// transaction. If schedule reconciliation (or any dependent write) throws, the
// medication insert rolls back too, so a half-saved medication never persists.
export async function createMedicationTx(
  userId: string,
  data: MedicationWriteData,
  today: string,
): Promise<Medication> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(medicationsTable)
      .values({
        userId,
        name: data.name,
        dosage: data.dosage,
        times: data.times,
        notes: data.notes,
      })
      .returning();
    await reconcileScheduleEntries(tx, row.id, userId, data.times, today);
    return row;
  });
}

// Update a medication and reconcile its schedule history in one transaction.
// Returns null when no row matched (not found / not owned). A failure during
// reconciliation rolls back the field update so the stored medication and its
// schedule entries never diverge.
export async function updateMedicationTx(
  id: number,
  userId: string,
  data: MedicationWriteData,
  today: string,
): Promise<Medication | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(medicationsTable)
      .set({
        name: data.name,
        dosage: data.dosage,
        times: data.times,
        notes: data.notes,
      })
      .where(
        and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)),
      )
      .returning();
    if (!row) return null;
    await reconcileScheduleEntries(tx, id, userId, data.times, today);
    return row;
  });
}

// Delete a medication in a transaction. Dependent rows (logs, schedule entries)
// are removed by DB cascade; wrapping in a transaction keeps the delete and any
// future dependent writes all-or-nothing. Returns null when nothing matched.
export async function deleteMedicationTx(
  id: number,
  userId: string,
): Promise<Medication | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(medicationsTable)
      .where(
        and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)),
      )
      .returning();
    return row ?? null;
  });
}

// Data the dose-log path accepts.
export interface LogDoseData {
  date: string;
  scheduledTime: string;
  effectiveness: number | null;
}

// Record (or update) a single dose log in a transaction so the medication/
// dose-time validation read and the log write are atomic: a concurrent edit or
// delete of the medication can't slip between the check and the insert. Returns
// null when the medication isn't found/owned or the time isn't scheduled.
export async function logDoseTx(
  id: number,
  userId: string,
  data: LogDoseData,
): Promise<MedicationLog | null> {
  return db.transaction(async (tx) => {
    const [med] = await tx
      .select()
      .from(medicationsTable)
      .where(
        and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)),
      );
    if (!med) return null;
    // The dose must be one of the medication's scheduled times.
    if (!normalizeTimes(med.times).includes(data.scheduledTime)) return null;

    // True idempotency via DB-level unique (user_id, medication_id, date, scheduled_time).
    // Only overwrite an existing rating when caller supplied one.
    const setOnConflict =
      data.effectiveness !== null
        ? { effectiveness: data.effectiveness }
        : { medicationId: medicationLogsTable.medicationId };
    const [log] = await tx
      .insert(medicationLogsTable)
      .values({
        medicationId: id,
        userId,
        date: data.date,
        scheduledTime: data.scheduledTime,
        effectiveness: data.effectiveness,
      })
      .onConflictDoUpdate({
        target: [
          medicationLogsTable.userId,
          medicationLogsTable.medicationId,
          medicationLogsTable.date,
          medicationLogsTable.scheduledTime,
        ],
        set: setOnConflict,
      })
      .returning();
    return log;
  });
}
