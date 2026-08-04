import { describe, it, expect } from "vitest";
import { toE164 } from "./twilio";

describe("toE164", () => {
  it("passes through numbers that already start with +", () => {
    expect(toE164("+1234567890")).toBe("+1234567890");
    expect(toE164("+44 20 7123 1234")).toBe("+442071231234");
    expect(toE164("+1 (555) 123-4567")).toBe("+15551234567");
  });

  it("adds +1 to bare 10-digit numbers (US/Canada assumption)", () => {
    expect(toE164("5551234567")).toBe("+15551234567");
    expect(toE164("(555) 123-4567")).toBe("+15551234567");
    expect(toE164("555.123.4567")).toBe("+15551234567");
    expect(toE164("555-123-4567")).toBe("+15551234567");
  });

  it("adds + to 11-digit numbers starting with 1 (US/Canada assumption)", () => {
    expect(toE164("15551234567")).toBe("+15551234567");
    expect(toE164("1 (555) 123-4567")).toBe("+15551234567");
    expect(toE164("1-555-123-4567")).toBe("+15551234567");
  });

  it("adds + to other numbers (international without +)", () => {
    expect(toE164("442071231234")).toBe("+442071231234");
    expect(toE164("81345678900")).toBe("+81345678900");
  });

  it("handles trailing, leading and embedded whitespaces correctly", () => {
    expect(toE164("  555 123 4567  ")).toBe("+15551234567");
    expect(toE164("  +1 555 123 4567  ")).toBe("+15551234567");
  });

  it("handles edge cases and short numbers", () => {
    expect(toE164("12345")).toBe("+12345");
    expect(toE164("")).toBe("+");
  });

  it("handles inputs with alphabetical characters", () => {
    // Current behavior strips all non-digits if no leading +,
    // so vanity numbers without translation just get stripped to digits
    expect(toE164("1-800-FLOWERS")).toBe("+1800");
    expect(toE164("invalid")).toBe("+");
  });

  it("handles strings with multiple plus signs", () => {
    expect(toE164("++1234567890")).toBe("++1234567890");
    expect(toE164("+1+234")).toBe("+1+234");
    // If it doesn't start with +, all non-digits are stripped
    expect(toE164("1+234")).toBe("+1234");
  });

});
