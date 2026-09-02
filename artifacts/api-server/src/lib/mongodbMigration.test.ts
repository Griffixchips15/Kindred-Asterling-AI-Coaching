import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OrderIndependentDigest, transformRow } from "@workspace/db";

describe("PostgreSQL to MongoDB migration", () => {
  it("preserves values while converting database column names", () => {
    const createdAt = new Date("2026-09-02T12:00:00.000Z");
    expect(
      transformRow(
        "users",
        {
          id: "user-1",
          clerk_user_id: "clerk-1",
          created_at: createdAt,
        },
        ["id"],
      ),
    ).toEqual({
      _id: "user-1",
      id: "user-1",
      clerkUserId: "clerk-1",
      createdAt,
    });
  });

  it("uses the same daily quota key as the runtime", () => {
    expect(
      transformRow(
        "daily_usage",
        { user_id: "user-1", date: "2026-09-02", count: 4 },
        ["user_id", "date"],
      )._id,
    ).toBe("user-1:2026-09-02");
  });

  it("computes a row-order-independent parity digest", () => {
    const left = new OrderIndependentDigest();
    const right = new OrderIndependentDigest();
    const first = { _id: 1, value: "a" };
    const second = { _id: 2, value: "b" };
    left.add(first);
    left.add(second);
    right.add(second);
    right.add(first);
    expect(left.hex()).toBe(right.hex());
  });

  it("enforces the snapshot and fresh-target safety gates", () => {
    const source = readFileSync(
      new URL(
        "../../../../lib/db/scripts/migrate-from-postgres.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("REPEATABLE READ READ ONLY");
    expect(source).toContain(
      "MONGODB_MIGRATION_DATABASE must differ from MONGODB_DATABASE",
    );
    expect(source).toContain("is not empty; use a new staging database");
    expect(source).not.toContain("MONGODB_MIGRATION_ALLOW_RUNTIME_TARGET");
    expect(source).toContain("sourceDigest");
    expect(source).toContain("validateReferences(target)");
    expect(source).not.toContain("dropDatabase");
  });
});
