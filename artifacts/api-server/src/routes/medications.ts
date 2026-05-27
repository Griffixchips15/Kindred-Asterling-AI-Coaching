import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, medicationsTable, medicationLogsTable } from "@workspace/db";
import { CreateMedicationBody, UpdateMedicationBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
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
  const takenMap = new Map<number, string>();
  for (const l of todays) {
    takenMap.set(l.medicationId, new Date(l.takenAt).toISOString());
  }
  const result = meds.map((m) => ({
    ...JSON.parse(JSON.stringify(m)),
    takenToday: takenMap.get(m.id) ?? null,
  }));
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
  // Idempotent: if already logged today, return existing.
  const [existing] = await db
    .select()
    .from(medicationLogsTable)
    .where(
      and(
        eq(medicationLogsTable.medicationId, id),
        eq(medicationLogsTable.userId, userId),
        eq(medicationLogsTable.date, today),
      ),
    );
  if (existing) {
    res.status(201).json(JSON.parse(JSON.stringify(existing)));
    return;
  }
  const [log] = await db
    .insert(medicationLogsTable)
    .values({ medicationId: id, userId, date: today })
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
