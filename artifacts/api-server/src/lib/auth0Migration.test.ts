import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, eq, usersTable } from "@workspace/db";
import { afterEach, describe, expect, it } from "vitest";
const ids: string[] = [];
const dirs: string[] = [];
afterEach(async () => { for (const id of ids.splice(0)) await db.delete(usersTable).where(eq(usersTable.id, id)); for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const dbDir = fileURLToPath(new URL("../../../../lib/db", import.meta.url));
function run(file: string, apply = false, allowLegacyWithoutClerk = false) {
  return execFileSync("pnpm", ["exec", "tsx", "./scripts/link-auth0-identities.ts", "--mapping", file, "--database", process.env.MONGODB_DATABASE!, ...(apply ? ["--apply"] : []), ...(allowLegacyWithoutClerk ? ["--allow-legacy-without-clerk"] : [])], { cwd: dbDir, encoding: "utf8", stdio: "pipe" });
}
describe("reviewed Auth0 migration command", () => {
  it("requires explicit opt-in for a reviewed account without a Clerk identity", async () => {
    const id = randomUUID(); ids.push(id);
    const subject = `google-oauth2|${randomUUID()}`;
    await db.insert(usersTable).values({ id, preferredName: "Legacy history owner" });
    const dir = await mkdtemp(join(tmpdir(), "kindred-auth0-test-")); dirs.push(dir);
    const file = join(dir, "mapping.json");
    await writeFile(file, JSON.stringify([{ userId: id, clerkUserId: null, auth0UserId: subject }]));
    expect(() => run(file, true)).toThrow();
    expect(run(file, false, true)).toContain("Validated (dry run)");
    expect((await db.select().from(usersTable).where(eq(usersTable.id, id)))[0].auth0UserId).toBeNull();
    expect(run(file, true, true)).toContain("Applied 1");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    expect(user.id).toBe(id);
    expect(user.clerkUserId).toBeNull();
    expect(user.auth0UserId).toBe(subject);
    expect(user.preferredName).toBe("Legacy history owner");
  });

  it("does not treat an omitted legacy identity as an explicit null", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kindred-auth0-test-")); dirs.push(dir);
    const file = join(dir, "mapping.json");
    await writeFile(file, JSON.stringify([{ userId: randomUUID(), auth0UserId: `auth0|${randomUUID()}` }]));
    expect(() => run(file, true, true)).toThrow();
  });

  it("rejects the entire batch when a null legacy mapping targets a Clerk-owned account", async () => {
    const legacyId = randomUUID(); const clerkId = randomUUID(); ids.push(legacyId, clerkId);
    await db.insert(usersTable).values({ id: legacyId });
    await db.insert(usersTable).values({ id: clerkId, clerkUserId: `clerk-${clerkId}` });
    const dir = await mkdtemp(join(tmpdir(), "kindred-auth0-test-")); dirs.push(dir);
    const file = join(dir, "mapping.json");
    await writeFile(file, JSON.stringify([legacyId, clerkId].map(id => ({ userId: id, clerkUserId: null, auth0UserId: `auth0|${id}` }))));
    expect(() => run(file, true, true)).toThrow();
    for (const id of [legacyId, clerkId]) {
      expect((await db.select().from(usersTable).where(eq(usersTable.id, id)))[0].auth0UserId).toBeNull();
    }
  });

  it("rejects assigning an Auth0 identity already owned by another account", async () => {
    const ownerId = randomUUID(); const legacyId = randomUUID(); ids.push(ownerId, legacyId);
    const subject = `auth0|${randomUUID()}`;
    await db.insert(usersTable).values({ id: ownerId, auth0UserId: subject });
    await db.insert(usersTable).values({ id: legacyId });
    const dir = await mkdtemp(join(tmpdir(), "kindred-auth0-test-")); dirs.push(dir);
    const file = join(dir, "mapping.json");
    await writeFile(file, JSON.stringify([{ userId: legacyId, clerkUserId: null, auth0UserId: subject }]));
    expect(() => run(file, true, true)).toThrow();
    expect((await db.select().from(usersTable).where(eq(usersTable.id, legacyId)))[0].auth0UserId).toBeNull();
    expect((await db.select().from(usersTable).where(eq(usersTable.id, ownerId)))[0].auth0UserId).toBe(subject);
  });
  it("defaults to dry run and applies an explicit mapping without changing ownership IDs", async () => {
    const id = randomUUID(); ids.push(id); const subject = `auth0|${randomUUID()}`;
    await db.insert(usersTable).values({ id, clerkUserId: `clerk-${id}`, preferredName: "Preserved" });
    const dir = await mkdtemp(join(tmpdir(), "kindred-auth0-test-")); dirs.push(dir); const file = join(dir, "mapping.json");
    await writeFile(file, JSON.stringify([{ userId: id, clerkUserId: `clerk-${id}`, auth0UserId: subject }]));
    expect(run(file)).toContain("Validated (dry run)");
    expect((await db.select().from(usersTable).where(eq(usersTable.id, id)))[0].auth0UserId).toBeNull();
    expect(run(file, true)).toContain("Applied 1");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    expect(user.auth0UserId).toBe(subject); expect(user.clerkUserId).toBe(`clerk-${id}`); expect(user.preferredName).toBe("Preserved");
  });
  it("rejects an incorrect legacy identity without modifying the account", async () => {
    const id = randomUUID(); ids.push(id);
    await db.insert(usersTable).values({ id, clerkUserId: `clerk-${id}` });
    const dir = await mkdtemp(join(tmpdir(), "kindred-auth0-test-")); dirs.push(dir); const file = join(dir, "mapping.json");
    await writeFile(file, JSON.stringify([{ userId: id, clerkUserId: "wrong", auth0UserId: `auth0|${id}` }]));
    expect(() => run(file, true)).toThrow();
    expect((await db.select().from(usersTable).where(eq(usersTable.id, id)))[0].auth0UserId).toBeNull();
  });
});
