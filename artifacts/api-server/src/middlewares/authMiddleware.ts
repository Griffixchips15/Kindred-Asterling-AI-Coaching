import { createClerkClient } from "@clerk/backend";
import type { WithAuthProp } from "@clerk/clerk-sdk-node";
import { db, usersTable } from "@workspace/db";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export interface ClerkIdentity {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  emailVerified: boolean;
}

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
});

declare global {
  namespace Express {
    interface User extends ClerkIdentity {}
    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User;
    }
    interface AuthedRequest {
      user: User;
    }
  }
}

export async function getClerkIdentity(userId: string): Promise<ClerkIdentity> {
  const user = await clerk.users.getUser(userId);
  const primary =
    user.emailAddresses.find(
      (item) => item.id === user.primaryEmailAddressId,
    ) ?? user.emailAddresses[0];
  return {
    id: user.id,
    email: primary?.emailAddress ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    profileImageUrl: user.imageUrl ?? null,
    emailVerified: primary?.verification?.status === "verified",
  };
}

export async function findClerkIdentitiesByEmail(
  email: string,
): Promise<ClerkIdentity[]> {
  const result = await clerk.users.getUserList({ emailAddress: [email] });
  return Promise.all(result.data.map((user) => getClerkIdentity(user.id)));
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];
  const userId = (req as WithAuthProp<Request>).auth?.userId;
  if (!userId) return next();

  try {
    const identity = await getClerkIdentity(userId);
    await db
      .insert(usersTable)
      .values({ id: identity.id })
      .onConflictDoNothing();
    req.user = identity;
  } catch (err) {
    logger.warn({ err, userId }, "Failed to resolve Clerk identity");
  }
  next();
}
