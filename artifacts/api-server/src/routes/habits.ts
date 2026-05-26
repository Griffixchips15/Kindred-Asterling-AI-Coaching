import { Router, type IRouter } from "express";
import { desc, eq, and, sql } from "drizzle-orm";
import { db, habitsTable, habitEntriesTable } from "@workspace/db";
import {
  CreateHabitBody,
  UpdateHabitParams,
  UpdateHabitBody,
  DeleteHabitParams,
  ListHabitEntriesParams,
  LogHabitEntryParams,
  LogHabitEntryBody,
  ListHabitsResponse,
  UpdateHabitResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/habits", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const habits = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.userId, userId))
    .orderBy(desc(habitsTable.createdAt));

  const withCounts = await Promise.all(
    habits.map(async (habit) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(habitEntriesTable)
        .where(
          and(
            eq(habitEntriesTable.habitId, habit.id),
            eq(habitEntriesTable.completed, true)
          )
        );
      return { ...habit, completedCount: count ?? 0 };
    })
  );

  res.json(ListHabitsResponse.parse(JSON.parse(JSON.stringify(withCounts))));
});

router.post("/habits", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const today = new Date().toISOString().split("T")[0];
  const [habit] = await db
    .insert(habitsTable)
    .values({
      userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      targetDays: parsed.data.targetDays ?? 90,
      startDate: parsed.data.startDate ?? today,
    })
    .returning();
  res.status(201).json(JSON.parse(JSON.stringify({ ...habit, completedCount: 0 })));
});

router.patch("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const params = UpdateHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [habit] = await db
    .update(habitsTable)
    .set(parsed.data)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)))
    .returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(habitEntriesTable)
    .where(
      and(
        eq(habitEntriesTable.habitId, habit.id),
        eq(habitEntriesTable.completed, true)
      )
    );
  res.json(UpdateHabitResponse.parse(JSON.parse(JSON.stringify({ ...habit, completedCount: count ?? 0 }))));
});

router.delete("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const params = DeleteHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [habit] = await db
    .delete(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)))
    .returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/habits/:id/entries", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const params = ListHabitEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Verify the habit belongs to this user
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)));
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  const entries = await db
    .select()
    .from(habitEntriesTable)
    .where(eq(habitEntriesTable.habitId, params.data.id))
    .orderBy(desc(habitEntriesTable.date));
  res.json(JSON.parse(JSON.stringify(entries)));
});

router.post("/habits/:id/entries", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const params = LogHabitEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = LogHabitEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Verify the habit belongs to this user
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)));
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  const [entry] = await db
    .insert(habitEntriesTable)
    .values({
      habitId: params.data.id,
      date: parsed.data.date,
      completed: parsed.data.completed,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(JSON.parse(JSON.stringify(entry)));
});

export default router;
