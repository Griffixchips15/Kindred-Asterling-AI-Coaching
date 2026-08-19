import { describe, expect, it } from "vitest";
import {
  deriveCalendarLoadSignal,
  selectKindredContextSources,
} from "./kindredContext";

describe("selectKindredContextSources", () => {
  it("selects only relevant source groups", () => {
    expect(
      selectKindredContextSources("How have my habit streaks been?"),
    ).toEqual(["habit_tracking"]);
    expect(selectKindredContextSources("hello there")).toEqual([]);
  });

  it("uses several load-related signals when the user describes overload", () => {
    expect(selectKindredContextSources("This week feels overwhelming")).toEqual(
      expect.arrayContaining([
        "morning_assessments",
        "evening_assessments",
        "body_scans",
        "calendar_load",
      ]),
    );
  });
});

describe("deriveCalendarLoadSignal", () => {
  it("derives counts without exposing event titles", () => {
    const signal = deriveCalendarLoadSignal(
      [
        { date: "2026-08-19", time: "9:00 AM", title: "Private title" },
        { date: "2026-08-19", time: "All day", title: "Another title" },
      ],
      2,
      new Date("2026-08-19T12:00:00"),
    );
    expect(signal.days[0]).toMatchObject({
      timedEventCount: 1,
      allDayEventCount: 1,
      totalEventCount: 2,
      level: "light",
    });
    expect(JSON.stringify(signal)).not.toContain("Private title");
  });

  it("marks consecutive busy days as sustained scheduling load", () => {
    const events = ["2026-08-19", "2026-08-20"].flatMap((date) =>
      Array.from({ length: 4 }, (_, index) => ({
        date,
        time: `${index + 9}:00 AM`,
        title: `event ${index}`,
      })),
    );
    const signal = deriveCalendarLoadSignal(
      events,
      2,
      new Date("2026-08-19T12:00:00"),
    );
    expect(signal.sustainedSchedulingLoad).toBe(true);
    expect(signal.interpretation).toBe("elevated_scheduled_load");
  });
});
