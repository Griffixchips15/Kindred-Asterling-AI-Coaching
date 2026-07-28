import { describe, it, expect } from "vitest";
import { normalizeTimes } from "./medicationSchedule";

describe("normalizeTimes", () => {
  it("should return an empty array when given an empty array", () => {
    expect(normalizeTimes([])).toEqual([]);
  });

  it("should trim whitespace from times", () => {
    expect(normalizeTimes([" 08:00 ", "12:00", "  20:00"])).toEqual([
      "08:00",
      "12:00",
      "20:00",
    ]);
  });

  it("should remove duplicate times", () => {
    expect(normalizeTimes(["08:00", "08:00", "12:00"])).toEqual([
      "08:00",
      "12:00",
    ]);
  });

  it("should sort times in ascending order", () => {
    expect(normalizeTimes(["20:00", "08:00", "12:00"])).toEqual([
      "08:00",
      "12:00",
      "20:00",
    ]);
  });

  it("should handle a combination of trimming, deduplication, and sorting", () => {
    expect(
      normalizeTimes([" 20:00", "08:00 ", " 12:00 ", "08:00", "20:00 "])
    ).toEqual(["08:00", "12:00", "20:00"]);
  });
});
