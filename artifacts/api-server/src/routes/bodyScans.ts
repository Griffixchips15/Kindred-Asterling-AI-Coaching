import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, bodyScansTable } from "@workspace/db";
import {
  CreateBodyScanBody,
  ListBodyScansResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { createBodyScanTx } from "../lib/journalWrites";

const router: IRouter = Router();

router.get("/body-scans", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const scans = await db
    .select()
    .from(bodyScansTable)
    .where(eq(bodyScansTable.userId, userId))
    .orderBy(desc(bodyScansTable.scannedAt));
  res.json(ListBodyScansResponse.parse(JSON.parse(JSON.stringify(scans))));
});

router.post("/body-scans", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const parsed = CreateBodyScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scan = await createBodyScanTx(userId, {
    scannedAt: parsed.data.scannedAt ? new Date(parsed.data.scannedAt) : new Date(),
    feelings: parsed.data.feelings ?? [],
    energyLevel: parsed.data.energyLevel,
    physicalSensations: parsed.data.physicalSensations ?? null,
    notes: parsed.data.notes ?? null,
  });
  res.status(201).json(scan);
});

export default router;
