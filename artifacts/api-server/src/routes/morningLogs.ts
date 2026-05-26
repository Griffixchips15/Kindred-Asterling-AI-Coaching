import { Router, type IRouter } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, morningLogsTable } from "@workspace/db";
import {
  CreateMorningLogBody,
  GetMorningLogParams,
  GetMorningLogResponse,
  ListMorningLogsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/morning-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const logs = await db
    .select()
    .from(morningLogsTable)
    .where(eq(morningLogsTable.userId, userId))
    .orderBy(desc(morningLogsTable.createdAt));
  res.json(ListMorningLogsResponse.parse(JSON.parse(JSON.stringify(logs))));
});

router.post("/morning-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const parsed = CreateMorningLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [log] = await db
    .insert(morningLogsTable)
    .values({
      userId,
      date: parsed.data.date,
      mentalLoadLevel: parsed.data.mentalLoadLevel,
      miniGoals: parsed.data.miniGoals ?? [],
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(GetMorningLogResponse.parse(JSON.parse(JSON.stringify(log))));
});

router.get("/morning-logs/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const params = GetMorningLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [log] = await db
    .select()
    .from(morningLogsTable)
    .where(and(eq(morningLogsTable.id, params.data.id), eq(morningLogsTable.userId, userId)));
  if (!log) {
    res.status(404).json({ error: "Morning log not found" });
    return;
  }
  res.json(GetMorningLogResponse.parse(JSON.parse(JSON.stringify(log))));
});

export default router;
