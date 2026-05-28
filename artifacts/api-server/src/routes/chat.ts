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
import { chatLimiter } from "../middlewares/rateLimiter";

const router: IRouter = Router();

const GEMINI_MODEL = "gemini-2.5-flash";
// Cap history sent to the model. Full history is still preserved in DB and
// shown in the UI, but only the most recent turns are sent on each call so
// that long sessions don't push token usage up or confuse the model with
// stale assistant fallbacks.
const HISTORY_TURN_LIMIT = 24;
// Hard cap on any single chat message stored or forwarded to the model.
// Mirrors the OpenAPI/Zod maxLength as a defense-in-depth measure so even a
// drifted contract can't push oversized text into the prompt.
const MAX_MESSAGE_CHARS = 4000;
// Hard cap on the total characters of conversation history sent to Gemini on
// any single /chat/send call. Even with per-message caps, 24 turns of
// near-limit messages would otherwise total ~96KB of attacker-controlled
// text. We trim oldest-first until the window fits this budget.
const MAX_HISTORY_CHARS = 24000;

function clipMessage(s: string): string {
  const t = s.trim();
  return t.length > MAX_MESSAGE_CHARS ? t.slice(0, MAX_MESSAGE_CHARS) : t;
}

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

function clip(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function buildSystemInstruction(user: User | null): string {
  const name = user?.preferredName ?? user?.firstName ?? "friend";
  const struggles = clip(user?.struggles, 500);
  const strengths = clip(user?.strengths, 500);
  const interests = clip(user?.interests, 500);
  const bio = clip(user?.bio, 1000);
  const quote = clip(user?.motivationalQuote, 280);
  const parts: string[] = [
    `You are Kindred, a warm, attentive personal wellness coach speaking with ${name}.`,
    "Speak like a real person — natural, grounded, and human. Keep replies short: 1-3 sentences unless they explicitly ask for depth.",
    "Each reply should do at most ONE of these: reflect what they said, share a small thought, or ask ONE specific follow-up question. Never stack multiple questions in a single reply.",
    "BANNED phrases — never use any of these or close paraphrases: 'tell me more', 'go on', 'please continue', 'say more about that', 'I'm here for you', 'I'm here with you', 'I hear you', 'that sounds tough', 'I'm listening'. They are hollow filler. If you have nothing specific to add, name one concrete detail from what they said instead.",
    "If you ask a follow-up, it MUST quote or name something concrete they actually said — a person, a moment, a feeling, a decision. Generic openers like 'what else' or 'how does that feel' are not allowed.",
    "Vary your openings and rhythm. Do not start consecutive replies the same way. It is fine — often better — to make a statement, share an observation, or simply sit with what they said without asking anything at all.",
    "If the user sends a short logistical message ('brb', 'heading to therapy', 'one sec'), reply with a short acknowledgement that names the thing they mentioned (e.g. 'Take your time at therapy.'). Never default to a generic 'tell me more'.",
    "Avoid sycophancy ('what a great question', 'that's amazing'). Avoid therapist clichés. Never give medical advice or diagnose.",
  ];
  if (user?.birthday) parts.push(`Their birthday is ${user.birthday}.`);
  if (struggles) parts.push(`They are working through: ${struggles}.`);
  if (strengths) parts.push(`Their strengths: ${strengths}.`);
  if (interests) parts.push(`They enjoy: ${interests}.`);
  if (bio) parts.push(`A bit about them, in their own words: ${bio}`);
  if (quote) parts.push(`A quote that means something to them: "${quote}". You may reference it occasionally when it fits naturally — never force it.`);
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

router.post("/chat/append", requireAuth, chatLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = AppendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const clipped = clipMessage(parsed.data.content);
  if (!clipped) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const userId = req.user!.id;
  const conv = await getOrCreateActive(userId);
  await db.insert(messages).values({
    conversationId: conv.id,
    role: parsed.data.role,
    content: clipped,
  });
  const full = await loadWithMessages(conv.id);
  res.json(JSON.parse(JSON.stringify(full)));
});

router.post("/chat/send", requireAuth, chatLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const clipped = clipMessage(parsed.data.content);
  if (!clipped) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const userId = req.user!.id;
  const userRow = await getCurrentUserRow(userId);
  const conv = await getOrCreateActive(userId);

  await db.insert(messages).values({
    conversationId: conv.id,
    role: "user",
    content: clipped,
  });

  // Bounded SQL fetch: only pull the most recent HISTORY_TURN_LIMIT rows
  // instead of the entire conversation. Otherwise an attacker who has
  // already stored thousands of messages can force an O(N) DB read +
  // serialize on every future /chat/send, even though the Gemini payload
  // itself is bounded by MAX_HISTORY_CHARS.
  const recentDesc = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(desc(messages.id))
    .limit(HISTORY_TURN_LIMIT);
  const recent = recentDesc.slice().reverse();
  // Further trim oldest-first so the total characters forwarded to Gemini
  // stay within MAX_HISTORY_CHARS, even if stored messages somehow exceed
  // the per-message cap. Always keep at least the most recent turn.
  const bounded: typeof recent = [];
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const len = recent[i].content.length;
    if (bounded.length > 0 && total + len > MAX_HISTORY_CHARS) break;
    bounded.unshift(recent[i]);
    total += len;
  }
  const contents = bounded.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: clipMessage(m.content) }],
  }));

  let assistantText: string | null = null;
  let failureReason: string | null = null;
  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: buildSystemInstruction(userRow),
        // gemini-2.5-flash enables internal "thinking" by default, which can
        // consume the entire output budget and return an empty .text. Disable
        // it for chat so every call yields a real reply.
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 400,
        temperature: 0.8,
      },
    });
    const text = result.text?.trim();
    if (text) {
      assistantText = text;
    } else {
      const cand = result.candidates?.[0];
      failureReason = cand?.finishReason ?? "empty_response";
      req.log.warn(
        {
          finishReason: cand?.finishReason,
          safetyRatings: cand?.safetyRatings,
          promptFeedback: result.promptFeedback,
        },
        "Gemini returned no text",
      );
    }
  } catch (err) {
    failureReason = "exception";
    req.log.error({ err }, "Gemini generateContent failed");
  }

  if (!assistantText) {
    // Do NOT persist a fallback assistant turn — it pollutes history and
    // makes the next call see broken context. Surface a transient error
    // to the client instead so the user can retry the same message.
    res.status(502).json({
      error: "assistant_unavailable",
      reason: failureReason,
      message:
        "Kindred couldn't put a reply together this time. Try sending that again.",
    });
    return;
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
