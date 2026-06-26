import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, reminderSettingsTable } from "@workspace/db";
import {
  GetReminderSettingsResponse,
  UpdateReminderSettingsBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Returns the user's reminder settings, creating a default row on first access
// so the rest of the app can always assume a row exists.
async function getOrCreateSettings(userId: string) {
  const [existing] = await db
    .select()
    .from(reminderSettingsTable)
    .where(eq(reminderSettingsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(reminderSettingsTable)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Lost the insert race — read the row the other request created.
  const [row] = await db
    .select()
    .from(reminderSettingsTable)
    .where(eq(reminderSettingsTable.userId, userId));
  return row;
}

router.get("/reminder-settings", requireAuth, async (req, res): Promise<void> => {
  const row = await getOrCreateSettings(req.user!.id);
  res.json(GetReminderSettingsResponse.parse(JSON.parse(JSON.stringify(row))));
});

router.patch("/reminder-settings", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateReminderSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid reminder settings" });
    return;
  }
  const userId = req.user!.id;
  await getOrCreateSettings(userId);

  const data = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.morningEnabled !== undefined) updates.morningEnabled = data.morningEnabled;
  if (data.morningTime !== undefined) updates.morningTime = data.morningTime;
  if (data.medicationEnabled !== undefined) updates.medicationEnabled = data.medicationEnabled;
  if (data.eveningEnabled !== undefined) updates.eveningEnabled = data.eveningEnabled;
  if (data.eveningTime !== undefined) updates.eveningTime = data.eveningTime;
  if (data.smsEnabled !== undefined) updates.smsEnabled = data.smsEnabled;
  if (data.emailEnabled !== undefined) updates.emailEnabled = data.emailEnabled;

  const [updated] = await db
    .update(reminderSettingsTable)
    .set(updates)
    .where(eq(reminderSettingsTable.userId, userId))
    .returning();

  res.json(GetReminderSettingsResponse.parse(JSON.parse(JSON.stringify(updated))));
});

export default router;
