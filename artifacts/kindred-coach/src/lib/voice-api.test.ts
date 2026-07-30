import { describe, it, expect } from "vitest";
import { appendTranscript } from "./voice-api";

describe("appendTranscript", () => {
  it("should handle undefined existing string", () => {
    expect(appendTranscript(undefined, "hello")).toBe("hello");
  });

  it("should handle empty existing string", () => {
    expect(appendTranscript("", "hello")).toBe("hello");
  });

  it("should return the existing string if addition is empty or only whitespace", () => {
    expect(appendTranscript("hello", "")).toBe("hello");
    expect(appendTranscript("hello", "   ")).toBe("hello");
  });

  it("should return empty string if both are undefined/empty", () => {
    expect(appendTranscript(undefined, "")).toBe("");
    expect(appendTranscript("", "   ")).toBe("");
  });

  it("should add a space joiner when existing does not end with space or newline", () => {
    expect(appendTranscript("hello", "world")).toBe("hello world");
  });

  it("should not add a space joiner when existing ends with a space", () => {
    expect(appendTranscript("hello ", "world")).toBe("hello world");
  });

  it("should not add a space joiner when existing ends with a newline", () => {
    expect(appendTranscript("hello\n", "world")).toBe("hello\nworld");
  });

  it("should trim the addition string before appending", () => {
    expect(appendTranscript("hello", "  world  ")).toBe("hello world");
    expect(appendTranscript("hello\n", "  world  ")).toBe("hello\nworld");
  });
});
