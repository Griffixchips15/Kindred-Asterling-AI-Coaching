import { describe, it, expect } from "vitest";
import { searchFeelings, ALL_FEELINGS } from "./feelings-wheel";

describe("searchFeelings", () => {
  it("returns an empty array for empty or whitespace-only queries", () => {
    expect(searchFeelings("")).toEqual([]);
    expect(searchFeelings("   ")).toEqual([]);
  });

  it("returns matching feelings case-insensitively", () => {
    const results = searchFeelings("happy");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(f => f.label === "Happy")).toBe(true);

    const upperResults = searchFeelings("HAPPY");
    expect(upperResults).toEqual(results);
  });

  it("trims whitespace from the query", () => {
    const normalResults = searchFeelings("sad");
    const whitespaceResults = searchFeelings("  sad  ");
    expect(whitespaceResults).toEqual(normalResults);
  });

  it("matches substrings", () => {
    const results = searchFeelings("app"); // Should match "Happy", "Appalled", etc.
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(f => f.label === "Happy")).toBe(true);
    expect(results.some(f => f.label === "Appalled")).toBe(true);
  });

  it("returns an empty array when no feelings match", () => {
    const results = searchFeelings("nonexistentfeeling123");
    expect(results).toEqual([]);
  });

  it("returns all feelings when query matches a common letter like 'e'", () => {
    const results = searchFeelings("e");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(ALL_FEELINGS.length);
  });
});
