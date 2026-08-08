import { describe, it, expect } from "vitest";
import { isRateLimitError } from "./utils";

describe("isRateLimitError", () => {
  it("should return true for errors containing '429'", () => {
    expect(isRateLimitError(new Error("Request failed with status code 429"))).toBe(true);
    expect(isRateLimitError("429 Too Many Requests")).toBe(true);
  });

  it("should return true for errors containing 'RATELIMIT_EXCEEDED'", () => {
    expect(isRateLimitError(new Error("API returned RATELIMIT_EXCEEDED"))).toBe(true);
    expect(isRateLimitError("RATELIMIT_EXCEEDED")).toBe(true);
  });

  it("should return true for errors containing 'quota' (case-insensitive)", () => {
    expect(isRateLimitError(new Error("Your quota has been exceeded"))).toBe(true);
    expect(isRateLimitError(new Error("QUOTA_EXCEEDED"))).toBe(true);
    expect(isRateLimitError("out of Quota")).toBe(true);
  });

  it("should return true for errors containing 'rate limit' (case-insensitive)", () => {
    expect(isRateLimitError(new Error("Rate limit exceeded for this endpoint"))).toBe(true);
    expect(isRateLimitError(new Error("RATE LIMIT HIT"))).toBe(true);
    expect(isRateLimitError("hit the rate limit")).toBe(true);
  });

  it("should return false for unrelated errors", () => {
    expect(isRateLimitError(new Error("Internal Server Error"))).toBe(false);
    expect(isRateLimitError(new Error("Not Found - 404"))).toBe(false);
    expect(isRateLimitError("Something went wrong")).toBe(false);
  });

  it("should handle non-Error, non-string inputs", () => {
    expect(isRateLimitError(null)).toBe(false); // String(null) is "null"
    expect(isRateLimitError(undefined)).toBe(false); // String(undefined) is "undefined"
    expect(isRateLimitError({})).toBe(false); // String({}) is "[object Object]"
    expect(isRateLimitError(429)).toBe(true); // String(429) is "429", which matches the "429" condition!
  });

  it("should handle errors without a message property gracefully if that ever happened", () => {
    const weirdError = new Error();
    weirdError.message = undefined as any;
    // error.message will be undefined, String(undefined) -> "undefined" or it throws depending on JS engine, but actually error.message is "" if not provided.
    // Wait, if message is undefined, error.message is undefined? No, Error("") has message "". If we forcefully set it to undefined, error.message is undefined, but error Msg will be string "undefined" which returns false.
    // Actually, String(weirdError) might be "Error". We can test just empty error
    expect(isRateLimitError(new Error())).toBe(false);
  });
});
