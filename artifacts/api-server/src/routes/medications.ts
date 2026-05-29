import { Router, type IRouter } from "express";
import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  db,
  medicationsTable,
  medicationLogsTable,
  medicationScheduleEntriesTable,
} from "@workspace/db";
import {
  CreateMedicationBody,
  UpdateMedicationBody,
  LogMedicationTakenBody,
  UnlogMedicationTakenBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// A database executor: either the top-level `db` or a transaction handle. Used so
// schedule reconciliation can run inside the same transaction as the med write.
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Largest valid UTC offset is ±14h; clamp anything outside that (and NaN → 0)
// so a malformed client value can't shift the day by an absurd amount.
function normalizeTzOffset(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return 0;
  const i = Math.trunc(n);
  return Math.max(-840, Math.min(840, i));
}

// JS Date.getTimezoneOffset() returns (UTC - local) in minutes, so subtracting
// it from a UTC instant yields that instant's local wall-clock. We then read the
// calendar day off the shifted instant via toISOString(). This gives one
// consistent "local day" notion used both when recording and reporting doses.
function localDateStr(instant: Date, tzOffsetMinutes: number): string {
  const local = new Date(instant.getTime() - tzOffsetMinutes * 60_000);
  return local.toISOString().split("T")[0];
}

function todayDateStr(tzOffsetMinutes = 0): string {
  return localDateStr(new Date(), tzOffsetMinutes);
}

function sevenDayWindowStartDateStr(tzOffsetMinutes: number): string {
  // Inclusive 7-day window: today and the previous 6 days, in local time.
  const local = new Date(Date.now() - tzOffsetMinutes * 60_000);
  local.setUTCDate(local.getUTCDate() - 6);
  return local.toISOString().split("T")[0];
}

function lastSevenDays(tzOffsetMinutes: number): string[] {
  // Oldest first: [today-6 ... today], in local time.
  const days: string[] = [];
  const base = new Date(Date.now() - tzOffsetMinutes * 60_000);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function parseId(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// Normalize a list of "HH:MM" times: trim, de-duplicate, and sort ascending.
function normalizeTimes(times: string[]): string[] {
  return Array.from(new Set(times.map((t) => t.trim()))).sort();
}

// Reconcile schedule history for a medication against a new set of times,
// effective `today`. Times newly present open a fresh active entry; times no
// longer present have their open entry closed (end_date = today, exclusive) so
// they still count for days before today. Re-adding a time that was removed
// earlier today simply re-opens that same entry (no double-count).
async function reconcileScheduleEntries(
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
        .where(eq(medicationScheduleEntriesTable.id, entry.id));
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

router.get("/medications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const tzOffset = normalizeTzOffset(req.query.tzOffset);
  const meds = await db
    .select()
    .from(medicationsTable)
    .where(eq(medicationsTable.userId, userId))
    .orderBy(asc(medicationsTable.name));

  const today = todayDateStr(tzOffset);
  const todays = await db
    .select()
    .from(medicationLogsTable)
    .where(and(eq(medicationLogsTable.userId, userId), eq(medicationLogsTable.date, today)));
  // Map keyed by `${medicationId}|${scheduledTime}` → today's log for that dose.
  const todayMap = new Map<string, { takenAt: string; effectiveness: number | null }>();
  for (const l of todays) {
    todayMap.set(`${l.medicationId}|${l.scheduledTime}`, {
      takenAt: new Date(l.takenAt).toISOString(),
      effectiveness: l.effectiveness ?? null,
    });
  }

  const sinceDate = sevenDayWindowStartDateStr(tzOffset);
  const recent = await db
    .select({
      medicationId: medicationLogsTable.medicationId,
      avg: sql<number | null>`avg(${medicationLogsTable.effectiveness})::float`,
      cnt: sql<number>`count(${medicationLogsTable.effectiveness})::int`,
    })
    .from(medicationLogsTable)
    .where(
      and(
        eq(medicationLogsTable.userId, userId),
        gte(medicationLogsTable.date, sinceDate),
      ),
    )
    .groupBy(medicationLogsTable.medicationId);
  const recentMap = new Map<number, { avg: number | null; cnt: number }>();
  for (const r of recent) {
    recentMap.set(r.medicationId, {
      avg: r.avg !== null ? Math.round(r.avg * 10) / 10 : null,
      cnt: r.cnt,
    });
  }

  const result = meds.map((m) => {
    const times = normalizeTimes(m.times);
    const r = recentMap.get(m.id) ?? { avg: null, cnt: 0 };
    const doses = times.map((scheduledTime) => {
      const t = todayMap.get(`${m.id}|${scheduledTime}`) ?? null;
      return {
        scheduledTime,
        takenAt: t?.takenAt ?? null,
        effectiveness: t?.effectiveness ?? null,
      };
    });
    return {
      ...JSON.parse(JSON.stringify(m)),
      times,
      doses,
      recentEffectivenessAvg: r.avg,
      recentEffectivenessCount: r.cnt,
    };
  });
  res.json(result);
});

router.get(
  "/medications/weekly-report",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.id;
    const tzOffset = normalizeTzOffset(req.query.tzOffset);
    const meds = await db
      .select()
      .from(medicationsTable)
      .where(eq(medicationsTable.userId, userId))
      .orderBy(asc(medicationsTable.name));

    const sinceDate = sevenDayWindowStartDateStr(tzOffset);
    const logs = await db
      .select()
      .from(medicationLogsTable)
      .where(
        and(
          eq(medicationLogsTable.userId, userId),
          gte(medicationLogsTable.date, sinceDate),
        ),
      );

    const scheduleEntries = await db
      .select()
      .from(medicationScheduleEntriesTable)
      .where(eq(medicationScheduleEntriesTable.userId, userId));
    const scheduleByMed = new Map<
      number,
      { scheduledTime: string; startDate: string; endDate: string | null }[]
    >();
    for (const e of scheduleEntries) {
      const list = scheduleByMed.get(e.medicationId) ?? [];
      list.push({
        scheduledTime: e.scheduledTime,
        startDate: typeof e.startDate === "string" ? e.startDate : String(e.startDate),
        endDate:
          e.endDate === null
            ? null
            : typeof e.endDate === "string"
              ? e.endDate
              : String(e.endDate),
      });
      scheduleByMed.set(e.medicationId, list);
    }

    res.json({
      days: lastSevenDays(tzOffset),
      medications: meds.map((m) => ({
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        schedule: scheduleByMed.get(m.id) ?? [],
        createdDate: localDateStr(new Date(m.createdAt), tzOffset),
      })),
      logs: logs.map((l) => ({
        medicationId: l.medicationId,
        date: typeof l.date === "string" ? l.date : String(l.date),
        scheduledTime: l.scheduledTime,
        takenAt: new Date(l.takenAt).toISOString(),
        effectiveness: l.effectiveness ?? null,
      })),
    });
  },
);

router.post("/medications", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMedicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const times = normalizeTimes(parsed.data.times);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(medicationsTable)
      .values({
        userId,
        name: parsed.data.name.trim(),
        dosage: parsed.data.dosage.trim(),
        times,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    await reconcileScheduleEntries(tx, row.id, userId, times, todayDateStr());
    return row;
  });
  res.status(201).json(JSON.parse(JSON.stringify(created)));
});

router.patch("/medications/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateMedicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const times = normalizeTimes(parsed.data.times);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(medicationsTable)
      .set({
        name: parsed.data.name.trim(),
        dosage: parsed.data.dosage.trim(),
        times,
        notes: parsed.data.notes ?? null,
      })
      .where(and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)))
      .returning();
    if (!row) return null;
    await reconcileScheduleEntries(tx, id, userId, times, todayDateStr());
    return row;
  });
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(JSON.parse(JSON.stringify(updated)));
});

router.delete("/medications/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = req.user!.id;
  const [deleted] = await db
    .delete(medicationsTable)
    .where(and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/medications/:id/log", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = LogMedicationTakenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scheduledTime = parsed.data.scheduledTime;
  const effectiveness = parsed.data.effectiveness ?? null;
  const tzOffset = normalizeTzOffset(parsed.data.tzOffset);

  const userId = req.user!.id;
  const [med] = await db
    .select()
    .from(medicationsTable)
    .where(and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)));
  if (!med) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // The dose must be one of the medication's scheduled times.
  if (!normalizeTimes(med.times).includes(scheduledTime)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const today = todayDateStr(tzOffset);
  // True idempotency via DB-level unique (user_id, medication_id, date, scheduled_time).
  // Only overwrite an existing rating when caller supplied one.
  const setOnConflict =
    effectiveness !== null
      ? { effectiveness }
      : { medicationId: medicationLogsTable.medicationId };
  const [log] = await db
    .insert(medicationLogsTable)
    .values({ medicationId: id, userId, date: today, scheduledTime, effectiveness })
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
  res.status(201).json(JSON.parse(JSON.stringify(log)));
});

router.delete("/medications/:id/log", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UnlogMedicationTakenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const today = todayDateStr(normalizeTzOffset(parsed.data.tzOffset));
  const [removed] = await db
    .delete(medicationLogsTable)
    .where(
      and(
        eq(medicationLogsTable.medicationId, id),
        eq(medicationLogsTable.userId, userId),
        eq(medicationLogsTable.date, today),
        eq(medicationLogsTable.scheduledTime, parsed.data.scheduledTime),
      ),
    )
    .returning();
  if (!removed) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
