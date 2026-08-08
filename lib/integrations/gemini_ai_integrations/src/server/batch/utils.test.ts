import { describe, it, expect } from "vitest";
import { isRateLimitError } from "./utils";

describe("isRateLimitError", () => {
  it("should return true for errors containing '429'", () => {
    expect(isRateLimitError(new Error("Request failed with status code 429"))).toBe(true);
    expect(isRateLimitError("429 Too Many Requests")).toBe(true);
    expect(isRateLimitError(429)).toBe(true); // Testing implicit string conversion
  });

  it("should return true for errors containing 'RATELIMIT_EXCEEDED'", () => {
    expect(isRateLimitError(new Error("Error: RATELIMIT_EXCEEDED"))).toBe(true);
    expect(isRateLimitError("RATELIMIT_EXCEEDED")).toBe(true);
  });

  it("should return true for errors containing 'quota' (case-insensitive)", () => {
    expect(isRateLimitError(new Error("You exceeded your current quota"))).toBe(true);
    expect(isRateLimitError("QUOTA_EXCEEDED")).toBe(true);
    expect(isRateLimitError("Quota limit reached")).toBe(true);
  });

  it("should return true for errors containing 'rate limit' (case-insensitive)", () => {
    expect(isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
    expect(isRateLimitError("RATE LIMIT Reached")).toBe(true);
  });

  it("should return false for unrelated errors", () => {
    expect(isRateLimitError(new Error("500 Internal Server Error"))).toBe(false);
    expect(isRateLimitError("Network connection failed")).toBe(false);
    expect(isRateLimitError("Not Found")).toBe(false);
  });

  it("should return false for non-string, non-error generic inputs that don't match", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError(500)).toBe(false);
    expect(isRateLimitError({})).toBe(false);
  });
});
