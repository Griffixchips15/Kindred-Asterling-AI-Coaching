import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, bodyScansTable } from "@workspace/db";
import {
  CreateBodyScanBody,
  ListBodyScansResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/body-scans", async (_req, res): Promise<void> => {
  const scans = await db
    .select()
    .from(bodyScansTable)
    .orderBy(desc(bodyScansTable.scannedAt));
  res.json(ListBodyScansResponse.parse(JSON.parse(JSON.stringify(scans))));
});

router.post("/body-scans", async (req, res): Promise<void> => {
  const parsed = CreateBodyScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [scan] = await db
    .insert(bodyScansTable)
    .values({
      scannedAt: parsed.data.scannedAt ? new Date(parsed.data.scannedAt) : new Date(),
      feelings: parsed.data.feelings ?? [],
      energyLevel: parsed.data.energyLevel,
      physicalSensations: parsed.data.physicalSensations ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(JSON.parse(JSON.stringify(scan)));
});

export default router;
