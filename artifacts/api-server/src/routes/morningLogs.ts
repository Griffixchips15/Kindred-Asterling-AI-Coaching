import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, morningLogsTable } from "@workspace/db";
import {
  CreateMorningLogBody,
  GetMorningLogParams,
  GetMorningLogResponse,
  ListMorningLogsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/morning-logs", async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(morningLogsTable)
    .orderBy(desc(morningLogsTable.createdAt));
  res.json(ListMorningLogsResponse.parse(logs));
});

router.post("/morning-logs", async (req, res): Promise<void> => {
  const parsed = CreateMorningLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [log] = await db
    .insert(morningLogsTable)
    .values({
      date: parsed.data.date,
      mentalLoadLevel: parsed.data.mentalLoadLevel,
      miniGoals: parsed.data.miniGoals ?? [],
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(GetMorningLogResponse.parse(log));
});

router.get("/morning-logs/:id", async (req, res): Promise<void> => {
  const params = GetMorningLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [log] = await db
    .select()
    .from(morningLogsTable)
    .where(eq(morningLogsTable.id, params.data.id));
  if (!log) {
    res.status(404).json({ error: "Morning log not found" });
    return;
  }
  res.json(GetMorningLogResponse.parse(log));
});

export default router;
