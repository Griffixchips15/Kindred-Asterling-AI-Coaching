import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

// Input is a reviewed mapping, not an email-matching heuristic. Never run against
// production without separately approved identity migration and rollback evidence.
const args = process.argv.slice(2);
const value = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const file = value("--mapping");
const expectedDatabase = value("--database");
const apply = args.includes("--apply");
// This flag is only for independently verified legacy accounts that predate Clerk.
// A mapping must explicitly contain null; omission must never bypass identity checks.
const allowLegacyWithoutClerk = args.includes("--allow-legacy-without-clerk");
if (!file || !expectedDatabase)
  throw new Error(
    "Usage: --mapping <reviewed.json> --database <expected-name> [--apply] [--allow-legacy-without-clerk]",
  );
if (expectedDatabase !== process.env.MONGODB_DATABASE)
  throw new Error("Expected database does not match MONGODB_DATABASE");
const input: unknown = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(input) || input.length === 0)
  throw new Error("Mapping must be a non-empty array");
const userIds = new Set<string>();
const subjects = new Set<string>();
const mappings = input.map((row: unknown) => {
  if (!row || typeof row !== "object") throw new Error("Invalid mapping");
  const record = row as Record<string, unknown>;
  if (
    typeof record.userId !== "string" ||
    !record.userId ||
    !((typeof record.clerkUserId === "string" && record.clerkUserId.length > 0) ||
      (record.clerkUserId === null && allowLegacyWithoutClerk)) ||
    typeof record.auth0UserId !== "string" ||
    !record.auth0UserId.includes("|")
  )
    throw new Error(
      "Each mapping requires userId, clerkUserId and auth0UserId",
    );
  if (userIds.has(record.userId) || subjects.has(record.auth0UserId))
    throw new Error("Duplicate application ID or Auth0 subject");
  userIds.add(record.userId);
  subjects.add(record.auth0UserId);
  return {
    userId: record.userId,
    clerkUserId: record.clerkUserId as string | null,
    auth0UserId: record.auth0UserId,
  };
});
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const collection = client.db(expectedDatabase).collection("users");
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const mapping of mappings) {
        const user = await collection.findOne(
          { id: mapping.userId },
          { session },
        );
        if (!user || (user.clerkUserId ?? null) !== mapping.clerkUserId)
          throw new Error(
            "Application and legacy identity mapping do not match",
          );
        if (user.auth0UserId && user.auth0UserId !== mapping.auth0UserId)
          throw new Error(
            "Application user already belongs to another Auth0 identity",
          );
        const owner = await collection.findOne(
          { auth0UserId: mapping.auth0UserId },
          { session },
        );
        if (owner && owner.id !== mapping.userId)
          throw new Error(
            "Auth0 identity already belongs to another application user",
          );
      }
      if (apply)
        for (const mapping of mappings) {
          const result = await collection.updateOne(
            { id: mapping.userId, clerkUserId: mapping.clerkUserId },
            {
              $set: { auth0UserId: mapping.auth0UserId, updatedAt: new Date() },
            },
            { session },
          );
          if (result.matchedCount !== 1)
            throw new Error("Expected exactly one unchanged account per mapping");
        }
    });
  } finally {
    await session.endSession();
  }
  console.log(
    `${apply ? "Applied" : "Validated (dry run)"} ${mappings.length} identity mappings. Application IDs and legacy mappings are preserved.`,
  );
} finally {
  await client.close();
}
