import type { NextFunction, Request, Response } from "express";
import { db, usersTable } from "@workspace/db";
import type { ClerkIdentity } from "./authMiddleware";

const identities = new Map<string, ClerkIdentity>();

/** Test-only stand-in for Clerk token verification; production never executes it. */
export function registerTestClerkIdentity(
  identity: Partial<ClerkIdentity> & { id: string },
): string {
  const token = `test-clerk-${identity.id}-${crypto.randomUUID()}`;
  identities.set(token, {
    email: `${identity.id}@example.test`,
    firstName: null,
    lastName: null,
    profileImageUrl: null,
    emailVerified: true,
    ...identity,
  });
  return token;
}

export function revokeTestClerkIdentity(token: string): void {
  identities.delete(token);
}

export async function testClerkIdentityAdapter(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];
  const header = req.header("authorization");
  const identity = header?.startsWith("Bearer ")
    ? identities.get(header.slice(7))
    : undefined;
  if (identity) {
    await db
      .insert(usersTable)
      .values({ id: identity.id })
      .onConflictDoNothing({ target: usersTable.id });
    req.user = identity;
  }
  next();
}
