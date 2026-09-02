import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { eq } from "@workspace/db";
import {
  db,
  usersTable,
  reminderSettingsTable,
  reminderDeliveriesTable,
} from "@workspace/db";

// The scheduler's only external dependencies are the two send libs, which we
// stub so the tests exercise the due/dedup/window logic without network calls.
vi.mock("./twilio", () => ({
  isSmsConfigured: vi.fn(() => true),
  sendSms: vi.fn(async () => true),
}));
vi.mock("./resend", () => ({
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn(async () => true),
}));
vi.mock("../middlewares/authMiddleware", () => ({
  getClerkIdentity: vi.fn(async () => ({
    email: "test@example.com",
    firstName: "Test",
    profileImageUrl: null,
    emailVerified: true,
  })),
}));

import * as twilio from "./twilio";
import * as resend from "./resend";
import { runReminderTick } from "./reminderScheduler";

const mockSendSms = vi.mocked(twilio.sendSms);
const mockSendEmail = vi.mocked(resend.sendEmail);

const suffix = Math.random().toString(36).slice(2, 10);
const userId = `test-rem-${suffix}`;
const email = `rem-${suffix}@example.test`;

// Use UTC so the user's local "HH:MM" equals the UTC time we pass in `now`.
const TZ = "UTC";

async function setSettings(
  over: Partial<typeof reminderSettingsTable.$inferInsert>,
) {
  await db
    .insert(reminderSettingsTable)
    .values({ userId, ...over })
    .onConflictDoUpdate({ target: reminderSettingsTable.userId, set: over });
}

async function deliveryCount(): Promise<number> {
  const rows = await db
    .select({ id: reminderDeliveriesTable.id })
    .from(reminderDeliveriesTable)
    .where(eq(reminderDeliveriesTable.userId, userId));
  return rows.length;
}

beforeAll(async () => {
  await db
    .insert(usersTable)
    .values({ id: userId, phone: "+15551234567", timezone: TZ })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
});

beforeEach(async () => {
  vi.clearAllMocks();
  mockSendSms.mockResolvedValue(true);
  mockSendEmail.mockResolvedValue(true);
  await db
    .delete(reminderDeliveriesTable)
    .where(eq(reminderDeliveriesTable.userId, userId));
});

describe("runReminderTick", () => {
  it("sends a morning reminder over both channels exactly once and dedupes on re-run", async () => {
    await setSettings({
      morningEnabled: true,
      morningTime: "08:00",
      eveningEnabled: false,
      medicationEnabled: false,
      smsEnabled: true,
      emailEnabled: true,
    });
    const now = new Date("2026-06-26T08:00:00Z");

    await runReminderTick(now);
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(await deliveryCount()).toBe(2); // one ledger row per channel

    // Re-running the same minute must not re-send.
    await runReminderTick(now);
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(await deliveryCount()).toBe(2);
  });

  it("fires within the catch-up window when a tick is late, but not outside it", async () => {
    await setSettings({
      morningEnabled: true,
      morningTime: "08:00",
      eveningEnabled: false,
      medicationEnabled: false,
      smsEnabled: false,
      emailEnabled: true,
    });

    // 5 minutes late — still inside the 10-minute window.
    await runReminderTick(new Date("2026-06-26T08:05:00Z"));
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Next day, 11 minutes late — outside the window, so it must not fire.
    vi.clearAllMocks();
    await runReminderTick(new Date("2026-06-27T08:11:00Z"));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("releases the reservation when a send fails so a later tick can retry", async () => {
    await setSettings({
      morningEnabled: true,
      morningTime: "08:00",
      eveningEnabled: false,
      medicationEnabled: false,
      smsEnabled: false,
      emailEnabled: true,
    });

    // First attempt: send fails -> no ledger row should remain.
    mockSendEmail.mockResolvedValueOnce(false);
    await runReminderTick(new Date("2026-06-26T08:00:00Z"));
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(await deliveryCount()).toBe(0);

    // Retry within the window now succeeds and records the delivery.
    await runReminderTick(new Date("2026-06-26T08:03:00Z"));
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(await deliveryCount()).toBe(1);
  });

  it("does not send when the user's local time hasn't reached the scheduled time", async () => {
    await setSettings({
      morningEnabled: true,
      morningTime: "08:00",
      eveningEnabled: false,
      medicationEnabled: false,
      smsEnabled: false,
      emailEnabled: true,
    });
    await runReminderTick(new Date("2026-06-26T07:55:00Z"));
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(await deliveryCount()).toBe(0);
  });

  it("skips channels with no destination or disabled", async () => {
    await setSettings({
      morningEnabled: true,
      morningTime: "08:00",
      eveningEnabled: false,
      medicationEnabled: false,
      smsEnabled: true,
      emailEnabled: false,
    });
    // User has a phone, so SMS should go out and email should not.
    await runReminderTick(new Date("2026-06-26T08:00:00Z"));
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
