import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  medicationsTable,
  medicationLogsTable,
  medicationScheduleEntriesTable,
} from "@workspace/db";
import * as schedule from "./medicationSchedule";
import {
  createMedicationTx,
  updateMedicationTx,
  deleteMedicationTx,
  logDoseTx,
} from "./medicationWrites";

// Wrap the real schedule reconciliation in a spy so individual tests can force
// it to throw mid-transaction (simulating a failed dependent write) while the
// default behavior stays the genuine implementation.
vi.mock("./medicationSchedule", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./medicationSchedule")>();
  return {
    ...actual,
    reconcileScheduleEntries: vi.fn(actual.reconcileScheduleEntries),
  };
});

const reconcileSpy = vi.mocked(schedule.reconcileScheduleEntries);

const userId = `test-med-tx-${Math.random().toString(36).slice(2, 10)}`;
const TODAY = "2026-05-29";

async function medsForUser() {
  return db
    .select()
    .from(medicationsTable)
    .where(eq(medicationsTable.userId, userId));
}

async function scheduleEntriesForUser() {
  return db
    .select()
    .from(medicationScheduleEntriesTable)
    .where(eq(medicationScheduleEntriesTable.userId, userId));
}

async function logsForUser() {
  return db
    .select()
    .from(medicationLogsTable)
    .where(eq(medicationLogsTable.userId, userId));
}

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({ id: userId, email: `${userId}@example.test` });
});

afterEach(async () => {
  reconcileSpy.mockClear();
  // Cascade removes logs + schedule entries for every med owned by the user.
  await db.delete(medicationsTable).where(eq(medicationsTable.userId, userId));
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
});

describe("createMedicationTx", () => {
  it("persists the medication and its schedule entries together", async () => {
    const med = await createMedicationTx(
      userId,
      { name: "Med A", dosage: "10mg", times: ["08:00", "20:00"], notes: null },
      TODAY,
    );

    expect(med.id).toBeTypeOf("number");
    const meds = await medsForUser();
    expect(meds).toHaveLength(1);
    const entries = await scheduleEntriesForUser();
    expect(entries.map((e) => e.scheduledTime).sort()).toEqual([
      "08:00",
      "20:00",
    ]);
  });

  it("rolls back the medication insert when reconciliation fails", async () => {
    reconcileSpy.mockImplementationOnce(async () => {
      throw new Error("reconcile boom");
    });

    await expect(
      createMedicationTx(
        userId,
        { name: "Doomed", dosage: "5mg", times: ["09:00"], notes: null },
        TODAY,
      ),
    ).rejects.toThrow("reconcile boom");

    // No half-saved medication and no orphaned schedule entries.
    expect(await medsForUser()).toHaveLength(0);
    expect(await scheduleEntriesForUser()).toHaveLength(0);
  });
});

describe("updateMedicationTx", () => {
  it("updates fields and reconciles the schedule together", async () => {
    const med = await createMedicationTx(
      userId,
      { name: "Before", dosage: "10mg", times: ["08:00"], notes: null },
      TODAY,
    );

    const updated = await updateMedicationTx(
      med.id,
      userId,
      {
        name: "After",
        dosage: "20mg",
        times: ["09:00", "10:00"],
        notes: "changed",
      },
      TODAY,
    );

    expect(updated?.name).toBe("After");
    const entries = await scheduleEntriesForUser();
    const active = entries.filter((e) => e.endDate === null);
    expect(active.map((e) => e.scheduledTime).sort()).toEqual([
      "09:00",
      "10:00",
    ]);
  });

  it("returns null when the medication isn't owned by the user", async () => {
    const result = await updateMedicationTx(
      999_999_999,
      userId,
      { name: "Nope", dosage: "1mg", times: ["08:00"], notes: null },
      TODAY,
    );
    expect(result).toBeNull();
  });

  it("rolls back field changes and schedule when reconciliation fails", async () => {
    const med = await createMedicationTx(
      userId,
      { name: "Original", dosage: "10mg", times: ["08:00"], notes: null },
      TODAY,
    );

    reconcileSpy.mockImplementationOnce(async () => {
      throw new Error("reconcile boom");
    });

    await expect(
      updateMedicationTx(
        med.id,
        userId,
        {
          name: "Should Not Stick",
          dosage: "99mg",
          times: ["09:00", "10:00"],
          notes: "nope",
        },
        TODAY,
      ),
    ).rejects.toThrow("reconcile boom");

    // The stored medication is untouched.
    const [row] = await medsForUser();
    expect(row.name).toBe("Original");
    expect(row.dosage).toBe("10mg");
    expect(row.times).toEqual(["08:00"]);

    // Schedule still reflects only the original time; no new entries leaked in.
    const entries = await scheduleEntriesForUser();
    expect(entries).toHaveLength(1);
    expect(entries[0].scheduledTime).toBe("08:00");
    expect(entries[0].endDate).toBeNull();
  });
});

describe("deleteMedicationTx", () => {
  it("removes the medication and cascades its logs and schedule entries", async () => {
    const med = await createMedicationTx(
      userId,
      { name: "ToDelete", dosage: "10mg", times: ["08:00"], notes: null },
      TODAY,
    );
    await logDoseTx(med.id, userId, {
      date: TODAY,
      scheduledTime: "08:00",
      effectiveness: 7,
    });

    expect(await logsForUser()).toHaveLength(1);
    expect(await scheduleEntriesForUser()).toHaveLength(1);

    const deleted = await deleteMedicationTx(med.id, userId);
    expect(deleted?.id).toBe(med.id);

    // Medication, logs, and schedule entries all gone together.
    expect(await medsForUser()).toHaveLength(0);
    expect(await logsForUser()).toHaveLength(0);
    expect(await scheduleEntriesForUser()).toHaveLength(0);
  });

  it("returns null when nothing matches", async () => {
    expect(await deleteMedicationTx(999_999_999, userId)).toBeNull();
  });
});

describe("logDoseTx", () => {
  it("records a dose and is idempotent on repeat (user+med+date+time)", async () => {
    const med = await createMedicationTx(
      userId,
      { name: "Logged", dosage: "10mg", times: ["08:00"], notes: null },
      TODAY,
    );

    const first = await logDoseTx(med.id, userId, {
      date: TODAY,
      scheduledTime: "08:00",
      effectiveness: 5,
    });
    expect(first?.effectiveness).toBe(5);

    const second = await logDoseTx(med.id, userId, {
      date: TODAY,
      scheduledTime: "08:00",
      effectiveness: 8,
    });
    expect(second?.effectiveness).toBe(8);

    // Still exactly one log row for that dose.
    const logs = await db
      .select()
      .from(medicationLogsTable)
      .where(
        and(
          eq(medicationLogsTable.medicationId, med.id),
          eq(medicationLogsTable.date, TODAY),
          eq(medicationLogsTable.scheduledTime, "08:00"),
        ),
      );
    expect(logs).toHaveLength(1);
  });

  it("returns null for a time that isn't scheduled and writes nothing", async () => {
    const med = await createMedicationTx(
      userId,
      { name: "Logged", dosage: "10mg", times: ["08:00"], notes: null },
      TODAY,
    );

    const result = await logDoseTx(med.id, userId, {
      date: TODAY,
      scheduledTime: "23:00",
      effectiveness: 5,
    });
    expect(result).toBeNull();
    expect(await logsForUser()).toHaveLength(0);
  });

  it("returns null when the medication isn't owned by the user", async () => {
    const result = await logDoseTx(999_999_999, userId, {
      date: TODAY,
      scheduledTime: "08:00",
      effectiveness: 5,
    });
    expect(result).toBeNull();
  });
});
