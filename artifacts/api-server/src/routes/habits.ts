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

const router: IRouter = Router();

router.get("/habits", async (_req, res): Promise<void> => {
  const habits = await db
    .select()
    .from(habitsTable)
    .orderBy(desc(habitsTable.createdAt));

  // Attach completedCount for each habit
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

  res.json(ListHabitsResponse.parse(withCounts));
});

router.post("/habits", async (req, res): Promise<void> => {
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const today = new Date().toISOString().split("T")[0];
  const [habit] = await db
    .insert(habitsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      targetDays: parsed.data.targetDays ?? 90,
      startDate: parsed.data.startDate ?? today,
    })
    .returning();
  res.status(201).json({ ...habit, completedCount: 0 });
});

router.patch("/habits/:id", async (req, res): Promise<void> => {
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
    .where(eq(habitsTable.id, params.data.id))
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
  res.json(UpdateHabitResponse.parse({ ...habit, completedCount: count ?? 0 }));
});

router.delete("/habits/:id", async (req, res): Promise<void> => {
  const params = DeleteHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [habit] = await db
    .delete(habitsTable)
    .where(eq(habitsTable.id, params.data.id))
    .returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/habits/:id/entries", async (req, res): Promise<void> => {
  const params = ListHabitEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const entries = await db
    .select()
    .from(habitEntriesTable)
    .where(eq(habitEntriesTable.habitId, params.data.id))
    .orderBy(desc(habitEntriesTable.date));
  res.json(entries);
});

router.post("/habits/:id/entries", async (req, res): Promise<void> => {
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
  const [entry] = await db
    .insert(habitEntriesTable)
    .values({
      habitId: params.data.id,
      date: parsed.data.date,
      completed: parsed.data.completed,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(entry);
});

export default router;
