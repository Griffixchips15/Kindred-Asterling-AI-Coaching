import { describe, expect, it } from "vitest";
import {
  deriveNextStep,
  deriveDailyJourney,
  type TodayInputs,
} from "./today";

function base(overrides: Partial<TodayInputs> = {}): TodayInputs {
  return {
    morningDone: true,
    eveningDone: true,
    bodyScansCount: 1,
    habitsCompletedToday: 1,
    totalHabits: 1,
    doses: null,
    medicationsUnavailable: false,
    medicationsLoading: false,
    ...overrides,
  };
}

function at(hour: number, minute = 0): Date {
  const d = new Date(2026, 0, 15, hour, minute, 0, 0);
  return d;
}

describe("deriveNextStep", () => {
  it("prioritises the morning check-in when incomplete", () => {
    const step = deriveNextStep(base({ morningDone: false }), at(9));
    expect(step.kind).toBe("morning");
    expect(step.href).toBe("/morning");
  });

  it("prompts a dose that is due but unrecorded", () => {
    const step = deriveNextStep(
      base({
        doses: [
          { scheduledTime: "08:00", takenAt: null },
          { scheduledTime: "20:00", takenAt: null },
        ],
      }),
      at(12),
    );
    expect(step.kind).toBe("medication");
    expect(step.href).toBe("/medications");
    expect(step.body).toContain("08:00");
  });

  it("does not prompt a dose whose time has not yet arrived", () => {
    const step = deriveNextStep(
      base({
        bodyScansCount: 0,
        doses: [{ scheduledTime: "21:00", takenAt: null }],
      }),
      at(12),
    );
    // The 21:00 dose isn't due, so we fall through to the body-scan prompt.
    expect(step.kind).toBe("body-scan");
  });

  it("ignores already-recorded doses", () => {
    const step = deriveNextStep(
      base({
        bodyScansCount: 0,
        doses: [{ scheduledTime: "08:00", takenAt: "2026-01-15T08:05:00.000Z" }],
      }),
      at(12),
    );
    expect(step.kind).toBe("body-scan");
  });

  it("recommends a body scan when none recorded today", () => {
    const step = deriveNextStep(base({ bodyScansCount: 0 }), at(12));
    expect(step.kind).toBe("body-scan");
    expect(step.href).toBe("/scans");
  });

  it("recommends habits when habits are incomplete", () => {
    const step = deriveNextStep(
      base({ totalHabits: 3, habitsCompletedToday: 1 }),
      at(12),
    );
    expect(step.kind).toBe("habit");
    expect(step.href).toBe("/habits");
  });

  it("does not recommend habits when no habits exist", () => {
    const step = deriveNextStep(
      base({ totalHabits: 0, habitsCompletedToday: 0, eveningDone: false }),
      at(12),
    );
    // No habits, scans done, before 5 PM → nothing but the (pre-5PM) evening gap is
    // not yet actionable, so we land on "on-track".
    expect(step.kind).toBe("on-track");
  });

  it("recommends the evening reflection after 5 PM when incomplete", () => {
    const step = deriveNextStep(base({ eveningDone: false }), at(18));
    expect(step.kind).toBe("evening");
    expect(step.href).toBe("/evening");
  });

  it("does not recommend evening reflection before 5 PM", () => {
    const step = deriveNextStep(base({ eveningDone: false }), at(10));
    expect(step.kind).toBe("on-track");
  });

  it("shows on-track when everything actionable is complete", () => {
    const step = deriveNextStep(base(), at(12));
    expect(step.kind).toBe("on-track");
  });

  it("skips the medication step when medication data is unavailable", () => {
    const step = deriveNextStep(
      base({
        bodyScansCount: 0,
        doses: null,
        medicationsUnavailable: true,
      }),
      at(12),
    );
    // Medication can't be inferred; we fall through to the body scan.
    expect(step.kind).toBe("body-scan");
  });

  it("treats an empty dose list as having no medication to prompt", () => {
    const step = deriveNextStep(
      base({ bodyScansCount: 0, doses: [] }),
      at(12),
    );
    expect(step.kind).toBe("body-scan");
  });

  it("does not prompt medication while medications are still loading", () => {
    const step = deriveNextStep(
      base({
        bodyScansCount: 0,
        doses: null,
        medicationsLoading: true,
      }),
      at(12),
    );
    expect(step.kind).toBe("body-scan");
  });

  it("selects the globally earliest due dose regardless of input order", () => {
    const step = deriveNextStep(
      base({
        // Deliberately unsorted and across "multiple medications".
        doses: [
          { scheduledTime: "21:00", takenAt: null },
          { scheduledTime: "06:30", takenAt: null },
          { scheduledTime: "12:15", takenAt: "2026-01-15T12:15:00.000Z" },
          { scheduledTime: "07:00", takenAt: null },
        ],
      }),
      at(10),
    );
    // 06:30 and 07:00 are due (<= 10:00); 06:30 is the earliest.
    expect(step.kind).toBe("medication");
    expect(step.body).toContain("06:30");
  });
});

describe("deriveDailyJourney", () => {
  it("reports Begin/Close completion truthfully", () => {
    const journey = deriveDailyJourney(
      base({ morningDone: false, eveningDone: false }),
    );
    expect(journey.find((j) => j.anchor === "Begin")?.complete).toBe(false);
    expect(journey.find((j) => j.anchor === "Close")?.complete).toBe(false);
  });

  it("reports the Notice anchor from body-scan counts", () => {
    const journey = deriveDailyJourney(base({ bodyScansCount: 2 }));
    const notice = journey.find((j) => j.anchor === "Notice");
    expect(notice?.complete).toBe(true);
    expect(notice?.status).toBe("2 scans today");
  });

  it("reports Tend as complete only when doses and habits are done", () => {
    const complete = deriveDailyJourney(
      base({
        totalHabits: 0,
        habitsCompletedToday: 0,
        doses: [{ scheduledTime: "08:00", takenAt: "yes" }],
      }),
    );
    expect(complete.find((j) => j.anchor === "Tend")?.complete).toBe(true);

    const partial = deriveDailyJourney(
      base({
        totalHabits: 2,
        habitsCompletedToday: 1,
      }),
    );
    expect(partial.find((j) => j.anchor === "Tend")?.complete).toBe(false);
  });

  it("never invents a percentage in any status", () => {
    const journey = deriveDailyJourney(
      base({
        morningDone: false,
        totalHabits: 4,
        habitsCompletedToday: 1,
        doses: [{ scheduledTime: "08:00", takenAt: null }],
      }),
    );
    for (const step of journey) {
      expect(step.status).not.toMatch(/%/);
    }
  });

  it("labels Tend with a truthful empty state when nothing is scheduled", () => {
    const journey = deriveDailyJourney(base({ totalHabits: 0 }));
    expect(journey.find((j) => j.anchor === "Tend")?.status).toBe(
      "Nothing scheduled",
    );
  });

  it("marks Tend 'Medication unavailable' and not complete when meds fail", () => {
    const journey = deriveDailyJourney(
      base({
        totalHabits: 0,
        habitsCompletedToday: 0,
        doses: null,
        medicationsUnavailable: true,
        medicationsLoading: false,
      }),
    );
    const tend = journey.find((j) => j.anchor === "Tend");
    expect(tend?.status).toBe("Medication unavailable");
    expect(tend?.complete).toBe(false);
    expect(tend?.status).not.toContain("Nothing scheduled");
  });

  it("routes medication-only Tend to /medications, not /habits", () => {
    const journey = deriveDailyJourney(
      base({
        totalHabits: 0,
        habitsCompletedToday: 0,
        doses: [{ scheduledTime: "08:00", takenAt: null }],
      }),
    );
    const tend = journey.find((j) => j.anchor === "Tend");
    expect(tend?.href).toBe("/medications");
  });

  it("routes Tend to /habits when habits are incomplete", () => {
    const journey = deriveDailyJourney(
      base({
        totalHabits: 3,
        habitsCompletedToday: 1,
        doses: null,
      }),
    );
    const tend = journey.find((j) => j.anchor === "Tend");
    expect(tend?.href).toBe("/habits");
  });

  it("does not mark Tend complete while medications are loading", () => {
    const journey = deriveDailyJourney(
      base({
        totalHabits: 0,
        habitsCompletedToday: 0,
        doses: null,
        medicationsLoading: true,
      }),
    );
    const tend = journey.find((j) => j.anchor === "Tend");
    expect(tend?.complete).toBe(false);
    expect(tend?.status).not.toContain("Nothing scheduled");
  });
});
