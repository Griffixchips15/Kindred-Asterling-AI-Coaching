import { type Request, type Response, type NextFunction } from "express";
import type { WithAuthProp } from "@clerk/clerk-sdk-node";
import { createClerkClient } from "@clerk/backend";
import { db, usersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { syncClerkIdentity } from "../lib/clerkIdentity";

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
      .where(
        and(
          eq(usersTable.clerkUserId, userId),
          isNull(usersTable.clerkDeletedAt),
        ),
      )
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
    req.user = await syncClerkIdentity(clerkUser);

    logger.info({ userId }, "User auto-created from Clerk auth");
  } catch (err) {
    logger.warn({ err, userId }, "Failed to auto-create user from Clerk auth");
  }

  next();
}
