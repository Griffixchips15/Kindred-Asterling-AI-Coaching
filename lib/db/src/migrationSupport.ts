import { createHash } from "node:crypto";
import type { Document } from "mongodb";

export function camelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Buffer.isBuffer(value)) return JSON.stringify(value.toString("base64"));
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  return JSON.stringify(value);
}

export class OrderIndependentDigest {
  private readonly value = Buffer.alloc(32);

  add(document: Document): void {
    const rowHash = createHash("sha256").update(canonical(document)).digest();
    for (let index = 0; index < this.value.length; index += 1) {
      this.value[index] ^= rowHash[index]!;
    }
  }

  hex(): string {
    return this.value.toString("hex");
  }
}

function mongoId(
  tableName: string,
  row: Record<string, unknown>,
  primaryKey: string[],
): unknown {
  if (tableName === "daily_usage") return `${row.userId}:${row.date}`;
  if (primaryKey.length === 0) {
    return createHash("sha256").update(canonical(row)).digest("hex");
  }
  if (primaryKey.length === 1) return row[camelCase(primaryKey[0]!)];
  return canonical(
    Object.fromEntries(
      primaryKey.map((column) => [camelCase(column), row[camelCase(column)]]),
    ),
  );
}

export function transformRow(
  tableName: string,
  row: Record<string, unknown>,
  primaryKey: string[],
): Document {
  const transformed = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [camelCase(key), value]),
  );
  const _id = mongoId(tableName, transformed, primaryKey);
  if (_id === null || _id === undefined) {
    throw new Error(
      `Source row is missing primary key ${primaryKey.join(", ")}`,
    );
  }
  return { _id, ...transformed };
}
