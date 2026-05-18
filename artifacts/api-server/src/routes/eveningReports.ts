import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, eveningReportsTable } from "@workspace/db";
import {
  CreateEveningReportBody,
  ListEveningReportsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/evening-reports", async (_req, res): Promise<void> => {
  const reports = await db
    .select()
    .from(eveningReportsTable)
    .orderBy(desc(eveningReportsTable.createdAt));
  res.json(ListEveningReportsResponse.parse(reports));
});

router.post("/evening-reports", async (req, res): Promise<void> => {
  const parsed = CreateEveningReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [report] = await db
    .insert(eveningReportsTable)
    .values({
      date: parsed.data.date,
      medicationEffectiveness: parsed.data.medicationEffectiveness,
      overallMood: parsed.data.overallMood ?? null,
      wins: parsed.data.wins ?? null,
      challenges: parsed.data.challenges ?? null,
      tomorrowIntent: parsed.data.tomorrowIntent ?? null,
    })
    .returning();
  res.status(201).json(report);
});

export default router;
