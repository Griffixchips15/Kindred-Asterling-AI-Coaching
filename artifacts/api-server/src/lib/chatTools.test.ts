import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  morningLogsTable,
  eveningReportsTable,
  bodyScansTable,
  habitsTable,
  habitEntriesTable,
  medicationsTable,
  medicationLogsTable,
} from "@workspace/db";
import { runChatTool } from "./chatTools";

// These tests drive the chat tool executor directly. runChatTool() is the seam
// that guarantees every tool Kindred calls mid-conversation reads ONLY the
// requesting user's rows — the user id comes from the session, never from the
// model. Wellness data (morning/evening/body-scan logs, habit streaks,
// medications) is the most sensitive class of user data per the threat model, so
// we seed two users with overlapping-shaped data and prove each tool returns the
// caller's rows and never the other user's, and that internal row IDs are never
// surfaced (existence of other records must not leak).

const suffix = Math.random().toString(36).slice(2, 10);
const userAId = `test-chattool-a-${suffix}`;
const userBId = `test-chattool-b-${suffix}`;

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

async function call(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  return JSON.parse(await runChatTool(name, input, userId));
}

// A unique, easy-to-find token per user so we can assert one user's content
// never appears in the other user's tool output.
const A = "AAA_only_userA";
const B = "BBB_only_userB";

beforeAll(async () => {
  await db.insert(usersTable).values([
    { id: userAId },
    { id: userBId },
  ]);

  const today = todayDateStr();

  // Morning logs
  await db.insert(morningLogsTable).values([
    {
      userId: userAId,
      date: today,
      mentalLoadLevel: "high",
      miniGoals: [A],
      notes: A,
    },
    {
      userId: userBId,
      date: today,
      mentalLoadLevel: "low",
      miniGoals: [B],
      notes: B,
    },
  ]);

  // Evening reports
  await db.insert(eveningReportsTable).values([
    {
      userId: userAId,
      date: today,
      medicationEffectiveness: 8,
      overallMood: A,
      wins: A,
      challenges: A,
      tomorrowIntent: A,
    },
    {
      userId: userBId,
      date: today,
      medicationEffectiveness: 3,
      overallMood: B,
      wins: B,
      challenges: B,
      tomorrowIntent: B,
    },
  ]);

  // Body scans
  await db.insert(bodyScansTable).values([
    {
      userId: userAId,
      scannedAt: new Date(),
      feelings: [A],
      energyLevel: 9,
      physicalSensations: A,
      notes: A,
    },
    {
      userId: userBId,
      scannedAt: new Date(),
      feelings: [B],
      energyLevel: 2,
      physicalSensations: B,
      notes: B,
    },
  ]);

  // Habits (+ a completed entry today so the streak math has something to chew)
  const [habitA] = await db
    .insert(habitsTable)
    .values({
      userId: userAId,
      name: A,
      description: A,
      targetDays: 30,
      startDate: today,
    })
    .returning();
  const [habitB] = await db
    .insert(habitsTable)
    .values({
      userId: userBId,
      name: B,
      description: B,
      targetDays: 60,
      startDate: today,
    })
    .returning();
  await db.insert(habitEntriesTable).values([
    { habitId: habitA.id, userId: userAId, date: today, completed: true },
    { habitId: habitB.id, userId: userBId, date: today, completed: true },
  ]);

  // Medications (+ one taken dose today)
  const [medA] = await db
    .insert(medicationsTable)
    .values({
      userId: userAId,
      name: A,
      dosage: A,
      times: ["08:00", "20:00"],
      notes: A,
    })
    .returning();
  const [medB] = await db
    .insert(medicationsTable)
    .values({
      userId: userBId,
      name: B,
      dosage: B,
      times: ["09:00"],
      notes: B,
    })
    .returning();
  await db.insert(medicationLogsTable).values([
    {
      medicationId: medA.id,
      userId: userAId,
      date: today,
      scheduledTime: "08:00",
      effectiveness: 7,
    },
    {
      medicationId: medB.id,
      userId: userBId,
      date: today,
      scheduledTime: "09:00",
      effectiveness: 5,
    },
  ]);
});

afterAll(async () => {
  // Cascade deletes remove all owned wellness rows.
  for (const id of [userAId, userBId]) {
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
  await pool.end();
});

// A tool's serialized output must never contain a numeric "id" field, and must
// never carry the other user's marker token.
function assertNoIds(serialized: string) {
  // Match an object key literally named "id" with a numeric value.
  expect(serialized).not.toMatch(/"id"\s*:\s*\d/);
  // habitId / medicationId style FKs are also internal — none should appear.
  expect(serialized).not.toMatch(/"\w*[Ii]d"\s*:\s*\d/);
}

describe("runChatTool scopes every tool to the requesting user", () => {
  const tools = [
    "get_recent_morning_logs",
    "get_recent_evening_reports",
    "get_recent_body_scans",
    "get_habits_with_streaks",
    "get_medications_status",
  ];

  it.each(tools)("%s returns only user A's data for user A", async (tool) => {
    const raw = await runChatTool(tool, {}, userAId);
    expect(raw).toContain(A);
    expect(raw).not.toContain(B);
    assertNoIds(raw);
  });

  it.each(tools)("%s returns only user B's data for user B", async (tool) => {
    const raw = await runChatTool(tool, {}, userBId);
    expect(raw).toContain(B);
    expect(raw).not.toContain(A);
    assertNoIds(raw);
  });
});

describe("tool output shapes carry the caller's content, not row IDs", () => {
  it("get_recent_morning_logs returns the caller's mental-load entry", async () => {
    const rows = (await call(
      "get_recent_morning_logs",
      {},
      userAId,
    )) as { mentalLoadLevel: string; notes: string; miniGoals: string[] }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].mentalLoadLevel).toBe("high");
    expect(rows[0].notes).toBe(A);
    expect(rows[0].miniGoals).toEqual([A]);
    expect(rows[0]).not.toHaveProperty("id");
    expect(rows[0]).not.toHaveProperty("userId");
  });

  it("get_recent_evening_reports returns the caller's reflection", async () => {
    const rows = (await call(
      "get_recent_evening_reports",
      {},
      userBId,
    )) as { overallMood: string; medicationEffectiveness: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].overallMood).toBe(B);
    expect(rows[0].medicationEffectiveness).toBe(3);
    expect(rows[0]).not.toHaveProperty("id");
    expect(rows[0]).not.toHaveProperty("userId");
  });

  it("get_recent_body_scans returns the caller's scan", async () => {
    const rows = (await call("get_recent_body_scans", {}, userAId)) as {
      energyLevel: number;
      physicalSensations: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].energyLevel).toBe(9);
    expect(rows[0].physicalSensations).toBe(A);
    expect(rows[0]).not.toHaveProperty("id");
    expect(rows[0]).not.toHaveProperty("userId");
  });

  it("get_habits_with_streaks returns the caller's habit without ids", async () => {
    const rows = (await call("get_habits_with_streaks", {}, userAId)) as {
      name: string;
      currentStreak: number;
      completedCount: number;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(A);
    expect(rows[0].currentStreak).toBe(1);
    expect(rows[0].completedCount).toBe(1);
    expect(rows[0]).not.toHaveProperty("id");
    expect(rows[0]).not.toHaveProperty("habitId");
    expect(rows[0]).not.toHaveProperty("userId");
  });

  it("get_medications_status returns the caller's doses and taken state", async () => {
    const rows = (await call("get_medications_status", {}, userAId)) as {
      name: string;
      doses: { scheduledTime: string; takenToday: boolean }[];
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(A);
    expect(rows[0]).not.toHaveProperty("id");
    const doses = rows[0].doses;
    expect(doses.map((d) => d.scheduledTime)).toEqual(["08:00", "20:00"]);
    expect(doses.find((d) => d.scheduledTime === "08:00")?.takenToday).toBe(
      true,
    );
    expect(doses.find((d) => d.scheduledTime === "20:00")?.takenToday).toBe(
      false,
    );
  });
});

describe("unknown tools fail safely", () => {
  it("returns an error payload without touching any user data", async () => {
    const out = (await call("get_everyones_data", {}, userAId)) as {
      error: string;
    };
    expect(out.error).toBe("unknown_tool");
  });
});
