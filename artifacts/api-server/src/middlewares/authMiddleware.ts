import { type Request, type Response, type NextFunction } from "express";
import type { WithAuthProp } from "@clerk/clerk-sdk-node";
import { createClerkClient } from "@clerk/backend";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
});

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
      emailVerifiedAt: Date | null;
    }

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const authReq = req as WithAuthProp<Request>;
  const userId = authReq.auth?.userId;
  if (!userId) {
    next();
    return;
  }

  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
        emailVerifiedAt: usersTable.emailVerifiedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user) {
      req.user = user;
      next();
      return;
    }
  } catch {
    // If DB lookup fails, proceed to fallback
  }

  // User not found in local DB — fetch from Clerk and create
  try {
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
    const emailVerified =
      clerkUser.emailAddresses?.[0]?.verification?.status === "verified";

    // Preserve an existing local account when its email matches the Clerk user.
    // This keeps existing data and subscriptions attached to the local user ID.
    if (email) {
      const [existingByEmail] = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          profileImageUrl: usersTable.profileImageUrl,
          emailVerifiedAt: usersTable.emailVerifiedAt,
        })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (existingByEmail) {
        req.user = existingByEmail;
        next();
        return;
      }
    }

    await db.insert(usersTable).values({
      id: userId,
      email,
      firstName: clerkUser.firstName ?? null,
      lastName: clerkUser.lastName ?? null,
      profileImageUrl: clerkUser.imageUrl ?? null,
      emailVerifiedAt: emailVerified ? new Date() : null,
    });

    req.user = {
      id: userId,
      email,
      firstName: clerkUser.firstName ?? null,
      lastName: clerkUser.lastName ?? null,
      profileImageUrl: clerkUser.imageUrl ?? null,
      emailVerifiedAt: emailVerified ? new Date() : null,
    };

    logger.info({ userId }, "User auto-created from Clerk auth");
  } catch (err) {
    logger.warn({ err, userId }, "Failed to auto-create user from Clerk auth");
  }

  next();
}
