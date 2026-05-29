import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  habitsTable,
  habitEntriesTable,
  morningLogsTable,
  bodyScansTable,
  eveningReportsTable,
} from "@workspace/db";
import * as writeContract from "./writeContract";
import {
  createHabitTx,
  logHabitEntryTx,
  createMorningLogTx,
  createBodyScanTx,
  createEveningReportTx,
  updateProfileTx,
} from "./journalWrites";

// Wrap the real finalize step in a spy so individual tests can force it to throw
// mid-transaction (simulating a failed dependent write/serialization) while the
// default behavior stays the genuine implementation.
vi.mock("./writeContract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./writeContract")>();
  return {
    ...actual,
    finalizeWrite: vi.fn(actual.finalizeWrite),
  };
});

const finalizeSpy = vi.mocked(writeContract.finalizeWrite);

// The genuine finalizeWrite implementation, used by the contract-validation
// tests below to run the real response-schema check against a tampered row.
const { finalizeWrite: realFinalizeWrite } = await vi.importActual<
  typeof import("./writeContract")
>("./writeContract");

const userId = `test-journal-tx-${Math.random().toString(36).slice(2, 10)}`;
const TODAY = "2026-05-29";

function failFinalizeOnce() {
  finalizeSpy.mockImplementationOnce(() => {
    throw new Error("finalize boom");
  });
}

async function habitsForUser() {
  return db.select().from(habitsTable).where(eq(habitsTable.userId, userId));
}

async function habitEntriesForUser() {
  return db
    .select()
    .from(habitEntriesTable)
    .where(eq(habitEntriesTable.userId, userId));
}

async function morningLogsForUser() {
  return db
    .select()
    .from(morningLogsTable)
    .where(eq(morningLogsTable.userId, userId));
}

async function bodyScansForUser() {
  return db
    .select()
    .from(bodyScansTable)
    .where(eq(bodyScansTable.userId, userId));
}

async function eveningReportsForUser() {
  return db
    .select()
    .from(eveningReportsTable)
    .where(eq(eveningReportsTable.userId, userId));
}

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({ id: userId, email: `${userId}@example.test` });
});

afterEach(async () => {
  finalizeSpy.mockClear();
  // Cascade removes habit entries owned by the user's habits.
  await db.delete(habitsTable).where(eq(habitsTable.userId, userId));
  await db.delete(morningLogsTable).where(eq(morningLogsTable.userId, userId));
  await db.delete(bodyScansTable).where(eq(bodyScansTable.userId, userId));
  await db
    .delete(eveningReportsTable)
    .where(eq(eveningReportsTable.userId, userId));
  // Reset profile fields touched by the profile tests.
  await db
    .update(usersTable)
    .set({ preferredName: null, bio: null })
    .where(eq(usersTable.id, userId));
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
});

describe("createHabitTx", () => {
  it("persists a new habit with a zero completed count", async () => {
    const habit = await createHabitTx(userId, {
      name: "Drink water",
      description: null,
      targetDays: 90,
      startDate: TODAY,
    });

    expect(habit.id).toBeTypeOf("number");
    expect(habit.completedCount).toBe(0);
    expect(await habitsForUser()).toHaveLength(1);
  });

  it("rolls back the habit insert when finalize fails", async () => {
    failFinalizeOnce();

    await expect(
      createHabitTx(userId, {
        name: "Doomed",
        description: null,
        targetDays: 90,
        startDate: TODAY,
      }),
    ).rejects.toThrow("finalize boom");

    expect(await habitsForUser()).toHaveLength(0);
  });
});

describe("logHabitEntryTx", () => {
  it("records an entry for a habit the user owns", async () => {
    const habit = await createHabitTx(userId, {
      name: "Stretch",
      description: null,
      targetDays: 90,
      startDate: TODAY,
    });

    const entry = await logHabitEntryTx(habit.id, userId, {
      date: TODAY,
      completed: true,
      notes: null,
    });

    expect(entry?.habitId).toBe(habit.id);
    expect(await habitEntriesForUser()).toHaveLength(1);
  });

  it("returns null and writes nothing when the habit isn't owned", async () => {
    const entry = await logHabitEntryTx(999_999_999, userId, {
      date: TODAY,
      completed: true,
      notes: null,
    });
    expect(entry).toBeNull();
    expect(await habitEntriesForUser()).toHaveLength(0);
  });

  it("rolls back the entry insert when finalize fails", async () => {
    const habit = await createHabitTx(userId, {
      name: "Journal",
      description: null,
      targetDays: 90,
      startDate: TODAY,
    });

    failFinalizeOnce();

    await expect(
      logHabitEntryTx(habit.id, userId, {
        date: TODAY,
        completed: true,
        notes: null,
      }),
    ).rejects.toThrow("finalize boom");

    // No orphaned entry left behind, the habit itself is untouched.
    expect(await habitEntriesForUser()).toHaveLength(0);
    expect(await habitsForUser()).toHaveLength(1);
  });
});

describe("createMorningLogTx", () => {
  it("persists a morning log", async () => {
    const log = await createMorningLogTx(userId, {
      date: TODAY,
      mentalLoadLevel: "medium",
      miniGoals: ["walk"],
      notes: null,
    });

    expect(log.id).toBeTypeOf("number");
    expect(await morningLogsForUser()).toHaveLength(1);
  });

  it("rolls back the insert when finalize fails", async () => {
    failFinalizeOnce();

    await expect(
      createMorningLogTx(userId, {
        date: TODAY,
        mentalLoadLevel: "high",
        miniGoals: [],
        notes: null,
      }),
    ).rejects.toThrow("finalize boom");

    expect(await morningLogsForUser()).toHaveLength(0);
  });
});

describe("createBodyScanTx", () => {
  it("persists a body scan", async () => {
    const scan = await createBodyScanTx(userId, {
      scannedAt: new Date("2026-05-29T08:00:00.000Z"),
      feelings: ["calm"],
      energyLevel: 7,
      physicalSensations: null,
      notes: null,
    });

    expect(scan.id).toBeTypeOf("number");
    expect(await bodyScansForUser()).toHaveLength(1);
  });

  it("rolls back the insert when finalize fails", async () => {
    failFinalizeOnce();

    await expect(
      createBodyScanTx(userId, {
        scannedAt: new Date("2026-05-29T08:00:00.000Z"),
        feelings: [],
        energyLevel: 3,
        physicalSensations: null,
        notes: null,
      }),
    ).rejects.toThrow("finalize boom");

    expect(await bodyScansForUser()).toHaveLength(0);
  });
});

describe("createEveningReportTx", () => {
  it("persists an evening report", async () => {
    const report = await createEveningReportTx(userId, {
      date: TODAY,
      medicationEffectiveness: 6,
      overallMood: "okay",
      wins: null,
      challenges: null,
      tomorrowIntent: null,
    });

    expect(report.id).toBeTypeOf("number");
    expect(await eveningReportsForUser()).toHaveLength(1);
  });

  it("rolls back the insert when finalize fails", async () => {
    failFinalizeOnce();

    await expect(
      createEveningReportTx(userId, {
        date: TODAY,
        medicationEffectiveness: 1,
        overallMood: null,
        wins: null,
        challenges: null,
        tomorrowIntent: null,
      }),
    ).rejects.toThrow("finalize boom");

    expect(await eveningReportsForUser()).toHaveLength(0);
  });
});

describe("response-contract validation rolls the save back", () => {
  // Instead of throwing arbitrarily, these tests run the genuine finalizeWrite
  // against a tampered serialized row so the real response schema rejects it,
  // proving an un-serializable record never commits.
  it("rolls back a body scan whose row violates the response schema", async () => {
    finalizeSpy.mockImplementationOnce((row, schema) =>
      realFinalizeWrite({ ...(row as object), energyLevel: "not-a-number" }, schema),
    );

    await expect(
      createBodyScanTx(userId, {
        scannedAt: new Date("2026-05-29T08:00:00.000Z"),
        feelings: ["calm"],
        energyLevel: 5,
        physicalSensations: null,
        notes: null,
      }),
    ).rejects.toThrow();

    expect(await bodyScansForUser()).toHaveLength(0);
  });

  it("rolls back a habit whose row violates the response schema", async () => {
    finalizeSpy.mockImplementationOnce((row, schema) =>
      realFinalizeWrite({ ...(row as object), completedCount: "lots" }, schema),
    );

    await expect(
      createHabitTx(userId, {
        name: "Contract breaker",
        description: null,
        targetDays: 90,
        startDate: TODAY,
      }),
    ).rejects.toThrow();

    expect(await habitsForUser()).toHaveLength(0);
  });
});

describe("updateProfileTx", () => {
  it("updates profile fields", async () => {
    const updated = await updateProfileTx(userId, {
      preferredName: "Sam",
      bio: "Hello there",
    });

    expect(updated?.preferredName).toBe("Sam");
    expect(updated?.bio).toBe("Hello there");
  });

  it("returns null when the user doesn't exist", async () => {
    const result = await updateProfileTx("no-such-user", {
      preferredName: "Ghost",
    });
    expect(result).toBeNull();
  });

  it("rolls back field changes when finalize fails", async () => {
    await updateProfileTx(userId, { preferredName: "Original", bio: "first" });

    failFinalizeOnce();

    await expect(
      updateProfileTx(userId, {
        preferredName: "Should Not Stick",
        bio: "nope",
      }),
    ).rejects.toThrow("finalize boom");

    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    expect(row.preferredName).toBe("Original");
    expect(row.bio).toBe("first");
  });
});
