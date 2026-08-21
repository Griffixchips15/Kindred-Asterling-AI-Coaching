import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";
import { syncClerkIdentity } from "../lib/clerkIdentity";

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
  const auth = getAuth(req);
  const { userId } = auth;
  if (!userId) {
    if (req.path.startsWith("/api") && req.path !== "/api/healthz") {
      const debug = auth.debug() as { reason?: unknown; status?: unknown };
      const pendingAuth = getAuth(req, { treatPendingAsSignedOut: false });
      logger.warn(
        {
          path: req.path,
          isAuthenticated: auth.isAuthenticated,
          tokenType: auth.tokenType,
          sessionStatus: auth.sessionStatus,
          pendingSessionHasUser: Boolean(pendingAuth.userId),
          authStatus:
            typeof debug.status === "string" ? debug.status : undefined,
          authReason:
            typeof debug.reason === "string" ? debug.reason : undefined,
        },
        "Clerk did not resolve a user session",
      );
    }
    return next();
  }

  try {
    const clerkUser = await getClerkIdentity(userId);
    const appUser = await syncClerkIdentity(clerkUser);
    if (!appUser) throw new Error("Clerk identity sync returned no user");
    // All application tables reference users.id, not Clerk's external user ID.
    req.user = {
      id: appUser.id,
      email: appUser.email,
      firstName: appUser.firstName,
      lastName: appUser.lastName,
      profileImageUrl: appUser.profileImageUrl,
      emailVerified: appUser.emailVerifiedAt != null,
    };
  } catch (err) {
    logger.warn({ err, userId }, "Failed to resolve Clerk identity");
  }
  next();
}
