import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  conversations,
  messages,
  type User,
} from "@workspace/db";
import { SendChatMessageBody, AppendChatMessageBody } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const GEMINI_MODEL = "gemini-2.5-flash";

async function getCurrentUserRow(userId: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return row ?? null;
}

async function getOrCreateActive(userId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.status, "active")))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(conversations)
    .values({ userId, title: "Coaching chat", status: "active" })
    .returning();
  return created;
}

async function loadWithMessages(conversationId: number) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!conv) return null;
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.id));
  return { ...conv, messages: msgs };
}

function buildSystemInstruction(user: User | null): string {
  const name = user?.preferredName ?? user?.firstName ?? "friend";
  const parts: string[] = [
    `You are Kindred, a warm, attentive personal wellness coach speaking with ${name}.`,
    "Speak conversationally and gently. Keep replies short (1-4 sentences) unless asked for depth.",
    "Reflect back what you hear before offering small, doable suggestions. Never give medical advice.",
  ];
  if (user?.birthday) parts.push(`Their birthday is ${user.birthday}.`);
  if (user?.struggles) parts.push(`They are working through: ${user.struggles}.`);
  if (user?.strengths) parts.push(`Their strengths: ${user.strengths}.`);
  if (user?.interests) parts.push(`They enjoy: ${user.interests}.`);
  return parts.join(" ");
}

const ONBOARDING_FIRST_PROMPT = (firstName: string | null | undefined): string =>
  `Hi${firstName ? " " + firstName : ""} — I'm Kindred, your daily wellness companion. I'd love to get to know you a little. What should I call you?`;

router.get("/chat/active", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const userRow = await getCurrentUserRow(userId);
  const conv = await getOrCreateActive(userId);
  const existing = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .limit(1);
  if (existing.length === 0 && userRow && !userRow.onboardedAt) {
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "assistant",
      content: ONBOARDING_FIRST_PROMPT(userRow.firstName),
    });
  }
  const full = await loadWithMessages(conv.id);
  res.json(JSON.parse(JSON.stringify(full)));
});

router.post("/chat/append", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = AppendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const userId = req.user!.id;
  const conv = await getOrCreateActive(userId);
  await db.insert(messages).values({
    conversationId: conv.id,
    role: parsed.data.role,
    content: parsed.data.content,
  });
  const full = await loadWithMessages(conv.id);
  res.json(JSON.parse(JSON.stringify(full)));
});

router.post("/chat/send", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const userId = req.user!.id;
  const userRow = await getCurrentUserRow(userId);
  const conv = await getOrCreateActive(userId);

  await db.insert(messages).values({
    conversationId: conv.id,
    role: "user",
    content: parsed.data.content,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.id));

  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let assistantText = "I'm here with you. Tell me more.";
  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: buildSystemInstruction(userRow),
      },
    });
    assistantText = result.text?.trim() || assistantText;
  } catch (err) {
    req.log.error({ err }, "Gemini generateContent failed");
  }

  await db.insert(messages).values({
    conversationId: conv.id,
    role: "assistant",
    content: assistantText,
  });

  const full = await loadWithMessages(conv.id);
  res.json(JSON.parse(JSON.stringify(full)));
});

router.post("/chat/archive", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const conv = await getOrCreateActive(userId);
  await db
    .update(conversations)
    .set({ status: "archived", archivedAt: new Date() })
    .where(eq(conversations.id, conv.id));
  const [created] = await db
    .insert(conversations)
    .values({ userId, title: "Coaching chat", status: "active" })
    .returning();
  const full = await loadWithMessages(created.id);
  res.json(JSON.parse(JSON.stringify(full)));
});

router.get("/chat/archived", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.status, "archived")))
    .orderBy(desc(conversations.archivedAt));
  res.json(JSON.parse(JSON.stringify(rows)));
});

router.get("/chat/archived/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const full = await loadWithMessages(conv.id);
  res.json(JSON.parse(JSON.stringify(full)));
});

export default router;
