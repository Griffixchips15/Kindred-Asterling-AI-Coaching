import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = (relative: string) =>
  readFileSync(path.resolve(here, relative), "utf8");

describe("cross-user query guards", () => {
  it("scopes record-id journal operations to the authenticated user", () => {
    for (const file of [
      "../routes/morningLogs.ts",
      "../routes/habits.ts",
      "journalWrites.ts",
    ]) {
      const text = source(file);
      expect(text).toContain("userId");
      expect(text).toMatch(/and\([\s\S]*?\.id[\s\S]*?\.userId/);
    }
    expect(source("../routes/habits.ts")).toContain(
      "eq(habitEntriesTable.userId, userId)",
    );
  });

  it("scopes medication and conversation mutations by id and owner", () => {
    expect(source("medicationWrites.ts")).toMatch(
      /and\([\s\S]*?medicationsTable\.id[\s\S]*?medicationsTable\.userId/,
    );
    const chat = source("../routes/chat.ts");
    expect(chat).toMatch(
      /eq\(conversations\.id, conversationId\),[\s\S]*?eq\(conversations\.userId, userId\)/,
    );
    expect(chat).toMatch(
      /eq\(conversations\.id, conv\.id\),[\s\S]*?eq\(conversations\.userId, userId\)/,
    );
  });

  it("never accepts a user id from the export or deletion request payload", () => {
    const account = source("../routes/account.ts");
    expect(account).toContain("req.user!.id");
    expect(account).not.toMatch(/req\.(body|params|query).*userId/);
  });
});
