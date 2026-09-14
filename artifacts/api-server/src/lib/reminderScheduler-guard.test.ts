import { afterEach, describe, expect, it, vi } from "vitest";
import cron from "node-cron";
import {
  reminderSchedulerDisabled,
  startReminderScheduler,
  stopReminderScheduler,
} from "./reminderScheduler";

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

afterEach(() => {
  delete process.env.REMINDER_SCHEDULER_DISABLED;
});

describe("reminderSchedulerDisabled", () => {
  it("is enabled by default (production behavior unchanged)", () => {
    delete process.env.REMINDER_SCHEDULER_DISABLED;
    process.env.NODE_ENV = "development";
    try {
      expect(reminderSchedulerDisabled()).toBe(false);
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  it("is suppressed when REMINDER_SCHEDULER_DISABLED=true", () => {
    process.env.REMINDER_SCHEDULER_DISABLED = "true";
    expect(reminderSchedulerDisabled()).toBe(true);
  });

  it("is suppressed in test mode even without the flag", () => {
    delete process.env.REMINDER_SCHEDULER_DISABLED;
    process.env.NODE_ENV = "test";
    expect(reminderSchedulerDisabled()).toBe(true);
  });
});

describe("startReminderScheduler", () => {
  it("does not schedule when REMINDER_SCHEDULER_DISABLED=true", () => {
    const schedule = vi.spyOn(cron, "schedule").mockReturnValue({
      stop: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof cron.schedule>);
    process.env.REMINDER_SCHEDULER_DISABLED = "true";
    process.env.NODE_ENV = "development";

    startReminderScheduler();
    expect(schedule).not.toHaveBeenCalled();
    schedule.mockRestore();
    stopReminderScheduler();
  });

  it("schedules normally when the flag is absent (production path kept)", () => {
    const schedule = vi.spyOn(cron, "schedule").mockReturnValue({
      stop: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof cron.schedule>);
    delete process.env.REMINDER_SCHEDULER_DISABLED;
    process.env.NODE_ENV = "development";

    startReminderScheduler();
    expect(schedule).toHaveBeenCalledTimes(1);
    schedule.mockRestore();
    stopReminderScheduler();
  });
});