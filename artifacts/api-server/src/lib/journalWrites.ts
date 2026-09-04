import { and, eq } from "@workspace/db";
import {
  db,
  habitsTable,
  habitEntriesTable,
  morningLogsTable,
  bodyScansTable,
  eveningReportsTable,
  usersTable,
} from "@workspace/db";
import {
  GetMorningLogResponse,
  ListBodyScansResponseItem,
  ListEveningReportsResponseItem,
  ListHabitsResponseItem,
  ListHabitEntriesResponseItem,
  UpdateProfileResponse,
  type Habit,
  type HabitEntry,
  type MorningLog,
  type BodyScan,
  type EveningReport,
  type AuthUser,
} from "@workspace/api-zod";
import { finalizeWrite } from "./writeContract";

// Every function here wraps its write(s) in a single transaction and runs
// finalizeWrite as the closing step. finalizeWrite serializes the new row and
// validates it against the matching response schema, so if anything inside the
// transaction throws — including a row that violates the API contract — the
// insert/update rolls back and a save can never leave a half-written, orphaned,
// or un-serializable row. New dependent writes added to a save should go inside
// the same transaction so they stay all-or-nothing.

export interface HabitWriteData {
  name: string;
  description: string | null;
  targetDays: number;
  startDate: string;
}

export async function createHabitTx(
  userId: string,
  data: HabitWriteData,
): Promise<Habit> {
  return db.transaction(async (tx) => {
    const [habit] = await tx
      .insert(habitsTable)
      .values({
        userId,
        name: data.name,
        description: data.description,
        targetDays: data.targetDays,
        startDate: data.startDate,
      })
      .returning();
    return finalizeWrite(
      { ...habit, completedCount: 0 },
      ListHabitsResponseItem,
    );
  });
}

export interface HabitEntryWriteData {
  date: string;
  completed: boolean;
  notes: string | null;
}

// Verify the parent habit is owned by the user and insert the entry in one
// transaction, so a concurrent habit delete can't slip between the check and
// the insert and leave an orphaned entry. Returns null when the habit isn't
// found or isn't owned by the user.
export async function logHabitEntryTx(
  habitId: number,
  userId: string,
  data: HabitEntryWriteData,
): Promise<HabitEntry | null> {
  return db.transaction(async (tx) => {
    const [habit] = await tx
      .select()
      .from(habitsTable)
      .where(and(eq(habitsTable.id, habitId), eq(habitsTable.userId, userId)));
    if (!habit) return null;
    const [entry] = await tx
      .insert(habitEntriesTable)
      .values({
        habitId,
        userId,
        date: data.date,
        completed: data.completed,
        notes: data.notes,
      })
      .returning();
    return finalizeWrite(entry, ListHabitEntriesResponseItem);
  });
}

export interface MorningLogWriteData {
  date: string;
  mentalLoadLevel: string;
  miniGoals: string[];
  notes: string | null;
}

export async function createMorningLogTx(
  userId: string,
  data: MorningLogWriteData,
): Promise<MorningLog> {
  return db.transaction(async (tx) => {
    const [log] = await tx
      .insert(morningLogsTable)
      .values({
        userId,
        date: data.date,
        mentalLoadLevel: data.mentalLoadLevel,
        miniGoals: data.miniGoals,
        notes: data.notes,
      })
      .returning();
    return finalizeWrite(log, GetMorningLogResponse);
  });
}

export interface BodyScanWriteData {
  scannedAt: Date;
  feelings: string[];
  energyLevel: number;
  physicalSensations: string | null;
  notes: string | null;
}

export async function createBodyScanTx(
  userId: string,
  data: BodyScanWriteData,
): Promise<BodyScan> {
  return db.transaction(async (tx) => {
    const [scan] = await tx
      .insert(bodyScansTable)
      .values({
        userId,
        scannedAt: data.scannedAt,
        feelings: data.feelings,
        energyLevel: data.energyLevel,
        physicalSensations: data.physicalSensations,
        notes: data.notes,
      })
      .returning();
    return finalizeWrite(scan, ListBodyScansResponseItem);
  });
}

export interface EveningReportWriteData {
  date: string;
  medicationEffectiveness: number;
  overallMood: string | null;
  wins: string | null;
  challenges: string | null;
  tomorrowIntent: string | null;
}

export async function createEveningReportTx(
  userId: string,
  data: EveningReportWriteData,
): Promise<EveningReport> {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .insert(eveningReportsTable)
      .values({
        userId,
        date: data.date,
        medicationEffectiveness: data.medicationEffectiveness,
        overallMood: data.overallMood,
        wins: data.wins,
        challenges: data.challenges,
        tomorrowIntent: data.tomorrowIntent,
      })
      .returning();
    return finalizeWrite(report, ListEveningReportsResponseItem);
  });
}

// Update a user's profile in a transaction. The caller passes only the columns
// it wants to change (plus updatedAt). Returns null when no user matched.
export async function updateProfileTx(
  userId: string,
  updates: Record<string, unknown>,
): Promise<AuthUser | null> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated) return null;
    return finalizeWrite(updated, UpdateProfileResponse);
  });
}
