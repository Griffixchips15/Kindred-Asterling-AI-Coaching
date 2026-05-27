import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, affirmationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const SEED_AFFIRMATIONS = [
  "You are exactly where you need to be today.",
  "Small steps in the right direction are still progress.",
  "Your calm is a quiet kind of strength.",
  "You are allowed to rest without earning it.",
  "Today's effort is enough, even when it feels small.",
  "You carry more wisdom than you give yourself credit for.",
  "Gentleness with yourself is not weakness — it's wisdom.",
  "You are becoming, and that takes time.",
  "Your feelings are valid, even the complicated ones.",
  "Breath by breath, you are finding your way.",
  "You do not have to be everything to everyone today.",
  "What you've already overcome speaks for what you can.",
  "You are worthy of the care you give to others.",
  "Today is a fresh page — write softly on it.",
  "Your presence matters more than your productivity.",
];

let seedChecked = false;

async function ensureSeeded(): Promise<void> {
  if (seedChecked) return;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(affirmationsTable);
  if ((count ?? 0) === 0) {
    await db
      .insert(affirmationsTable)
      .values(SEED_AFFIRMATIONS.map((text) => ({ text })));
  }
  seedChecked = true;
}

const router: IRouter = Router();

router.get("/affirmations/today", requireAuth, async (_req, res): Promise<void> => {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(affirmationsTable)
    .where(sql`${affirmationsTable.isActive} = true`)
    .orderBy(affirmationsTable.id);
  if (rows.length === 0) {
    res.status(404).json({ error: "No affirmations available" });
    return;
  }
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
  const chosen = rows[dayOfYear % rows.length];
  res.json(JSON.parse(JSON.stringify(chosen)));
});

router.get("/affirmations/random", requireAuth, async (_req, res): Promise<void> => {
  await ensureSeeded();
  const [row] = await db
    .select()
    .from(affirmationsTable)
    .where(sql`${affirmationsTable.isActive} = true`)
    .orderBy(sql`random()`)
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No affirmations available" });
    return;
  }
  res.json(JSON.parse(JSON.stringify(row)));
});

export default router;
