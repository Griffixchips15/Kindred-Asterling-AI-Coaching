import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { primaryEmail } from "./clerkIdentity";
import { planLegacyIdentityMigration } from "./clerkIdentityMigration";

describe("explicit Clerk identity mapping", () => {
  it("maps an existing legacy user while retaining the application ID", () => {
    expect(
      planLegacyIdentityMigration(
        [{ id: "app-1", email: "person@example.com", clerkUserId: null }],
        [{ id: "clerk-1", primaryEmail: "person@example.com" }],
      ).mappings,
    ).toEqual([{ userId: "app-1", clerkUserId: "clerk-1" }]);
  });

  it("uses Clerk's declared primary email even when it is not first", () => {
    expect(
      primaryEmail({
        id: "clerk-1",
        primaryEmailAddressId: "email-2",
        emailAddresses: [
          { id: "email-1", emailAddress: "old@example.com" },
          {
            id: "email-2",
            emailAddress: "new@example.com",
            verification: { status: "verified" },
          },
        ],
      }),
    ).toEqual({ email: "new@example.com", emailVerified: true });
  });

  it("keeps an existing explicit mapping after the primary email changes", () => {
    const plan = planLegacyIdentityMigration(
      [
        { id: "app-1", email: "old@example.com", clerkUserId: "clerk-1" },
        { id: "app-2", email: "new@example.com", clerkUserId: null },
      ],
      [{ id: "clerk-1", primaryEmail: "new@example.com" }],
    );
    expect(plan).toEqual({
      mappings: [{ userId: "app-1", clerkUserId: "clerk-1" }],
      ambiguous: [],
    });
  });

  it("reports case-insensitive duplicate email matches for manual resolution", () => {
    const plan = planLegacyIdentityMigration(
      [
        { id: "app-1", email: "same@example.com", clerkUserId: null },
        { id: "app-2", email: "SAME@example.com", clerkUserId: null },
      ],
      [{ id: "clerk-1", primaryEmail: "same@example.com" }],
    );
    expect(plan.ambiguous[0].candidateUserIds).toEqual(["app-1", "app-2"]);
    expect(plan.mappings).toHaveLength(0);
  });

  it("makes webhook retries idempotent by conflicting on clerk_user_id", () => {
    const source = readFileSync(
      new URL("./clerkIdentity.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("target: usersTable.clerkUserId");
  });

  it("marks deleted Clerk users instead of deleting application users", () => {
    const source = readFileSync(
      new URL("../routes/clerk-webhook.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("await markClerkIdentityDeleted(data.id)");
    expect(source).not.toMatch(/delete\(usersTable\)/);
  });

  it("uses the same transactional sync when auth beats the creation webhook", () => {
    const auth = readFileSync(
      new URL("../middlewares/authMiddleware.ts", import.meta.url),
      "utf8",
    );
    const webhook = readFileSync(
      new URL("../routes/clerk-webhook.ts", import.meta.url),
      "utf8",
    );
    expect(auth).toContain("await syncClerkIdentity(clerkUser)");
    expect(webhook).toContain("await syncClerkIdentity({");
  });

  it("uses Clerk's supported Express middleware for production sessions", () => {
    const app = readFileSync(new URL("../app.ts", import.meta.url), "utf8");
    const auth = readFileSync(
      new URL("../middlewares/authMiddleware.ts", import.meta.url),
      "utf8",
    );

    expect(app).toContain('import { clerkMiddleware } from "@clerk/express"');
    expect(app).toContain("clerkMiddleware({");
    expect(app.indexOf("clerkMiddleware({")).toBeLessThan(
      app.indexOf("app.use(\n  helmet({"),
    );
    expect(app).not.toContain("expressWithAuth");
    expect(auth).toContain('import { getAuth } from "@clerk/express"');
    expect(auth).toContain("const auth = getAuth(req)");
    expect(auth).toContain("const { userId } = auth");
    expect(auth).toContain('typeof debug.reason === "string"');
    expect(auth).toContain("treatPendingAsSignedOut: false");
    expect(auth).toContain(
      "pendingSessionHasUser: Boolean(pendingAuth.userId)",
    );
    expect(auth).not.toContain("...auth.debug()");
    expect(auth).not.toContain("WithAuthProp");
  });
});
