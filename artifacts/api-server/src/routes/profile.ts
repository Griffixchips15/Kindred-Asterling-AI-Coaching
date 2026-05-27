import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }
  const userId = req.user!.id;
  const data = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.preferredName !== undefined) updates.preferredName = data.preferredName;
  if (data.birthday !== undefined) updates.birthday = data.birthday;
  if (data.struggles !== undefined) updates.struggles = data.struggles;
  if (data.strengths !== undefined) updates.strengths = data.strengths;
  if (data.interests !== undefined) updates.interests = data.interests;
  if (data.onboardedAt !== undefined) {
    updates.onboardedAt = data.onboardedAt ? new Date(data.onboardedAt) : null;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(JSON.parse(JSON.stringify(updated)));
});

export default router;
