import { describe, it, expect, vi } from "vitest";
import { finalizeWrite, ResponseSchema } from "./writeContract";

describe("finalizeWrite", () => {
  it("parses and returns a plain object using the schema", () => {
    const mockSchema: ResponseSchema<{ id: number; name: string }> = {
      parse: vi.fn((val: any) => ({ id: val.id, name: val.name })),
    };

    const row = { id: 1, name: "Test" };
    const result = finalizeWrite(row, mockSchema);

    expect(result).toEqual({ id: 1, name: "Test" });
    expect(mockSchema.parse).toHaveBeenCalledWith({ id: 1, name: "Test" });
  });

  it("serializes dates into strings before passing to schema", () => {
    const mockSchema: ResponseSchema<{ date: string }> = {
      parse: vi.fn((val: any) => ({ date: val.date })),
    };

    const date = new Date("2023-01-01T00:00:00.000Z");
    const row = { date };
    const result = finalizeWrite(row, mockSchema);

    expect(result).toEqual({ date: "2023-01-01T00:00:00.000Z" });
    expect(mockSchema.parse).toHaveBeenCalledWith({ date: "2023-01-01T00:00:00.000Z" });
  });

  it("drops fields with undefined values due to JSON.stringify behavior", () => {
    const mockSchema: ResponseSchema<{ id: number }> = {
      parse: vi.fn((val: any) => ({ id: val.id })),
    };

    const row = { id: 1, extra: undefined };
    const result = finalizeWrite(row, mockSchema);

    expect(result).toEqual({ id: 1 });
    expect(mockSchema.parse).toHaveBeenCalledWith({ id: 1 });
  });

  it("throws if the schema parse throws", () => {
    const mockSchema: ResponseSchema<{ id: number }> = {
      parse: vi.fn(() => {
        throw new Error("Invalid schema");
      }),
    };

    const row = { invalid: true };
    expect(() => finalizeWrite(row, mockSchema)).toThrowError("Invalid schema");
  });
});
