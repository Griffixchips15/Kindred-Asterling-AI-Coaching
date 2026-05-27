import { Router, type IRouter } from "express";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db, medicationsTable, medicationLogsTable } from "@workspace/db";
import {
  CreateMedicationBody,
  UpdateMedicationBody,
  LogMedicationTakenBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

function sevenDayWindowStartDateStr(): string {
  // Inclusive 7-day window: today and the previous 6 days.
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split("T")[0];
}

function parseId(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

router.get("/medications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const meds = await db
    .select()
    .from(medicationsTable)
    .where(eq(medicationsTable.userId, userId))
    .orderBy(asc(medicationsTable.timeOfDay));

  const today = todayDateStr();
  const todays = await db
    .select()
    .from(medicationLogsTable)
    .where(and(eq(medicationLogsTable.userId, userId), eq(medicationLogsTable.date, today)));
  const todayMap = new Map<number, { takenAt: string; effectiveness: number | null }>();
  for (const l of todays) {
    todayMap.set(l.medicationId, {
      takenAt: new Date(l.takenAt).toISOString(),
      effectiveness: l.effectiveness ?? null,
    });
  }

  const sinceDate = sevenDayWindowStartDateStr();
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
    const t = todayMap.get(m.id) ?? null;
    const r = recentMap.get(m.id) ?? { avg: null, cnt: 0 };
    return {
      ...JSON.parse(JSON.stringify(m)),
      takenToday: t?.takenAt ?? null,
      effectivenessToday: t?.effectiveness ?? null,
      recentEffectivenessAvg: r.avg,
      recentEffectivenessCount: r.cnt,
    };
  });
  res.json(result);
});

router.post("/medications", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMedicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const [created] = await db
    .insert(medicationsTable)
    .values({
      userId,
      name: parsed.data.name.trim(),
      dosage: parsed.data.dosage.trim(),
      timeOfDay: parsed.data.timeOfDay,
      notes: parsed.data.notes ?? null,
    })
    .returning();
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
  const [updated] = await db
    .update(medicationsTable)
    .set({
      name: parsed.data.name.trim(),
      dosage: parsed.data.dosage.trim(),
      timeOfDay: parsed.data.timeOfDay,
      notes: parsed.data.notes ?? null,
    })
    .where(and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)))
    .returning();
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
  // Body is optional; when present, it can carry an effectiveness rating.
  const bodyToParse =
    req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
      ? req.body
      : {};
  const parsed = LogMedicationTakenBody.safeParse(bodyToParse);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const effectiveness = parsed.data.effectiveness ?? null;

  const userId = req.user!.id;
  const [med] = await db
    .select()
    .from(medicationsTable)
    .where(and(eq(medicationsTable.id, id), eq(medicationsTable.userId, userId)));
  if (!med) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const today = todayDateStr();
  // True idempotency via DB-level unique (user_id, medication_id, date).
  // Only overwrite an existing rating when caller supplied one.
  const setOnConflict =
    effectiveness !== null
      ? { effectiveness }
      : { medicationId: medicationLogsTable.medicationId };
  const [log] = await db
    .insert(medicationLogsTable)
    .values({ medicationId: id, userId, date: today, effectiveness })
    .onConflictDoUpdate({
      target: [
        medicationLogsTable.userId,
        medicationLogsTable.medicationId,
        medicationLogsTable.date,
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
  const userId = req.user!.id;
  const today = todayDateStr();
  const [removed] = await db
    .delete(medicationLogsTable)
    .where(
      and(
        eq(medicationLogsTable.medicationId, id),
        eq(medicationLogsTable.userId, userId),
        eq(medicationLogsTable.date, today),
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
