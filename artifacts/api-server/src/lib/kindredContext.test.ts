import { describe, expect, it, vi } from "vitest";
import {
  assembleKindredContext,
  selectKindredContextSources,
} from "./kindredContext";
import { runChatTool } from "./chatTools";

vi.mock("./chatTools", () => ({ runChatTool: vi.fn(async () => "[]") }));

describe("Kindred context after Calendar retirement", () => {
  it("selects the remaining relevant sources", () => {
    expect(
      selectKindredContextSources("How have my habit streaks been?"),
    ).toEqual(["habit_tracking"]);
    expect(selectKindredContextSources("hello there")).toEqual([]);
    expect(selectKindredContextSources("This week feels overwhelming")).toEqual(
      ["morning_assessments", "evening_assessments", "body_scans"],
    );
  });

  it.each([
    "What is on my calendar?",
    "My schedule is packed with meetings",
    "I am overwhelmed and drained",
  ])("does not fetch calendar data for %s", async (message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const context = await assembleKindredContext("user-123", message);
      expect(context.selection.sources).not.toContain("calendar_load");
      expect(context).not.toHaveProperty("calendarLoad");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("still assembles habitual coaching context", async () => {
    await assembleKindredContext("user-123", "How are my habits?");
    expect(runChatTool).toHaveBeenCalledWith(
      "get_habits_with_streaks",
      { limit: 7 },
      "user-123",
    );
  });
});
