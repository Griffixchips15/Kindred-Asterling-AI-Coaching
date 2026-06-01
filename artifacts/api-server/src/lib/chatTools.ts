import { and, desc, eq } from "drizzle-orm";
import {
  db,
  morningLogsTable,
  eveningReportsTable,
  bodyScansTable,
  habitsTable,
  habitEntriesTable,
  medicationsTable,
  medicationLogsTable,
} from "@workspace/db";
import type Anthropic from "@anthropic-ai/sdk";

const DEFAULT_LIMIT = 7;
const MAX_LIMIT = 30;
// Per-field clip limits for tool outputs. Keeps individual fields from
// bloating a tool result even when the DB contains near-limit stored values.
const TOOL_FIELD_SHORT = 200;   // names, dosage, mood strings
const TOOL_FIELD_LONG  = 1000;  // notes, sensations, wins/challenges

function clampLimit(n: unknown): number {
  const v =
    typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, v));
}

function clipStr(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

// Tool definitions Kindred can call during a chat turn. Every tool is scoped
// server-side to the requesting user (see runChatTool) — the model never gets
// to choose whose data it reads. Outputs deliberately exclude internal row IDs
// so existence of other records can't leak and the prompt stays small.
export const chatTools: Anthropic.Tool[] = [
  {
    name: "get_recent_morning_logs",
    description:
      "Get the user's most recent morning check-ins (mental-load level, mini goals, notes), newest first. Use when the conversation is about how their days have been starting, their mental load, focus, or morning routine.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "How many recent entries to return (1-30, default 7).",
        },
      },
    },
  },
  {
    name: "get_recent_evening_reports",
    description:
      "Get the user's most recent evening reflections (overall mood, wins, challenges, intention for tomorrow, how their medication felt), newest first. Use when the conversation is about how days have been ending, their mood, recent wins or struggles.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "How many recent entries to return (1-30, default 7).",
        },
      },
    },
  },
  {
    name: "get_recent_body_scans",
    description:
      "Get the user's most recent body scans (feelings, energy level 1-10, physical sensations, notes), newest first. Use when the conversation is about how their body feels, energy, pain, tension, or physical symptoms.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "How many recent entries to return (1-30, default 7).",
        },
      },
    },
  },
  {
    name: "get_habits_with_streaks",
    description:
      "Get the user's habits with their current streak, longest streak, and total completed days. Use when the conversation is about their habits, consistency, routines, or progress.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_medications_status",
    description:
      "Get the user's medications (name, dosage, notes) along with each scheduled dose time and whether that specific dose has been taken today. Medications can have multiple doses per day. Use when the conversation is about their medication, doses, or whether they've taken something today.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

async function getRecentMorningLogs(
  userId: string,
  limit: number,
): Promise<unknown> {
  const rows = await db
    .select()
    .from(morningLogsTable)
    .where(eq(morningLogsTable.userId, userId))
    .orderBy(desc(morningLogsTable.date))
    .limit(limit);
  return rows.map((r) => ({
    date: r.date,
    mentalLoadLevel: r.mentalLoadLevel,
    miniGoals: (r.miniGoals ?? []).map((g) => clipStr(g, TOOL_FIELD_SHORT)).filter(Boolean),
    notes: clipStr(r.notes, TOOL_FIELD_LONG),
  }));
}

async function getRecentEveningReports(
  userId: string,
  limit: number,
): Promise<unknown> {
  const rows = await db
    .select()
    .from(eveningReportsTable)
    .where(eq(eveningReportsTable.userId, userId))
    .orderBy(desc(eveningReportsTable.date))
    .limit(limit);
  return rows.map((r) => ({
    date: r.date,
    overallMood: clipStr(r.overallMood, TOOL_FIELD_SHORT),
    wins: clipStr(r.wins, TOOL_FIELD_LONG),
    challenges: clipStr(r.challenges, TOOL_FIELD_LONG),
    tomorrowIntent: clipStr(r.tomorrowIntent, TOOL_FIELD_LONG),
    medicationEffectiveness: r.medicationEffectiveness,
  }));
}

async function getRecentBodyScans(
  userId: string,
  limit: number,
): Promise<unknown> {
  const rows = await db
    .select()
    .from(bodyScansTable)
    .where(eq(bodyScansTable.userId, userId))
    .orderBy(desc(bodyScansTable.scannedAt))
    .limit(limit);
  return rows.map((r) => ({
    scannedAt: new Date(r.scannedAt).toISOString(),
    feelings: (r.feelings ?? []).map((f) => clipStr(f, TOOL_FIELD_SHORT)).filter(Boolean),
    energyLevel: r.energyLevel,
    physicalSensations: clipStr(r.physicalSensations, TOOL_FIELD_LONG),
    notes: clipStr(r.notes, TOOL_FIELD_LONG),
  }));
}

async function getHabitsWithStreaks(userId: string): Promise<unknown> {
  const habits = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.userId, userId));

  return Promise.all(
    habits.map(async (habit) => {
      const entries = await db
        .select()
        .from(habitEntriesTable)
        .where(
          and(
            eq(habitEntriesTable.userId, userId),
            eq(habitEntriesTable.habitId, habit.id),
            eq(habitEntriesTable.completed, true),
          ),
        )
        .orderBy(desc(habitEntriesTable.date));

      // Mirror the streak math used by the dashboard so the AI and the UI
      // always agree on the numbers.
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      const today = new Date();
      const completedDates = entries.map((e) => e.date);
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        if (completedDates.includes(ds)) {
          if (i === 0 || currentStreak > 0) currentStreak++;
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          if (i > 0 && currentStreak > 0) break;
          tempStreak = 0;
        }
      }

      return {
        name: clipStr(habit.name, TOOL_FIELD_SHORT),
        description: clipStr(habit.description, TOOL_FIELD_LONG),
        targetDays: habit.targetDays,
        currentStreak,
        longestStreak,
        completedCount: entries.length,
      };
    }),
  );
}

async function getMedicationsStatus(userId: string): Promise<unknown> {
  const meds = await db
    .select()
    .from(medicationsTable)
    .where(eq(medicationsTable.userId, userId));
  const today = todayDateStr();
  const todays = await db
    .select()
    .from(medicationLogsTable)
    .where(
      and(
        eq(medicationLogsTable.userId, userId),
        eq(medicationLogsTable.date, today),
      ),
    );
  const takenSet = new Set(todays.map((l) => `${l.medicationId}|${l.scheduledTime}`));
  return meds.map((m) => {
    const times = Array.from(new Set(m.times.map((t) => t.trim()))).sort();
    return {
      name: clipStr(m.name, TOOL_FIELD_SHORT),
      dosage: clipStr(m.dosage, TOOL_FIELD_SHORT),
      notes: clipStr(m.notes, TOOL_FIELD_LONG),
      doses: times.map((scheduledTime) => ({
        scheduledTime,
        takenToday: takenSet.has(`${m.id}|${scheduledTime}`),
      })),
    };
  });
}

// Execute a tool call. ALWAYS scoped to the passed userId, which is derived
// from the session — never from anything the model produced.
export async function runChatTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<string> {
  let data: unknown;
  switch (name) {
    case "get_recent_morning_logs":
      data = await getRecentMorningLogs(userId, clampLimit(input.limit));
      break;
    case "get_recent_evening_reports":
      data = await getRecentEveningReports(userId, clampLimit(input.limit));
      break;
    case "get_recent_body_scans":
      data = await getRecentBodyScans(userId, clampLimit(input.limit));
      break;
    case "get_habits_with_streaks":
      data = await getHabitsWithStreaks(userId);
      break;
    case "get_medications_status":
      data = await getMedicationsStatus(userId);
      break;
    default:
      data = { error: "unknown_tool" };
  }
  return JSON.stringify(data);
}
