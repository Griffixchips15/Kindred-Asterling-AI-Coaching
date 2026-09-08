import { auth } from "express-oauth2-jwt-bearer";
import type { NextFunction, Request, Response, RequestHandler } from "express";
import { logger } from "../lib/logger";
import {
  IdentityLinkRequiredError,
  syncAuth0Identity,
  type AuthIdentity,
} from "../lib/auth0Identity";

declare global {
  namespace Express {
    interface User extends AuthIdentity {}
    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User;
    }
    interface AuthedRequest {
      user: User;
    }
  }
}

export function createAuth0Middleware(options: {
  issuerBaseURL: string;
  audience: string;
  profileFetch?: typeof fetch;
  syncIdentity?: typeof syncAuth0Identity;
}): RequestHandler {
  const checkToken = auth({
    issuerBaseURL: options.issuerBaseURL,
    audience: options.audience,
    tokenSigningAlg: "RS256",
  });
  return (req, res, next) => {
    req.isAuthenticated = function (this: Request) {
      return this.user != null;
    } as Request["isAuthenticated"];
    if (!req.headers.authorization) return next();
    checkToken(req, res, (err?: unknown) => {
      if (
        err ||
        typeof req.auth?.payload.sub !== "string" ||
        req.auth.payload.sub.endsWith("@clients")
      ) {
        res
          .status(401)
          .set("WWW-Authenticate", 'Bearer error="invalid_token"')
          .json({ error: "Unauthorized" });
        return;
      }
      void resolveIdentity(req, res, next, options);
    });
  };
}
let productionMiddleware: RequestHandler | undefined;
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];
  if (!req.headers.authorization) return next();
  const domain = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  if (!domain || !audience) {
    res.status(503).json({ error: "Authentication is not configured" });
    return;
  }
  productionMiddleware ??= createAuth0Middleware({
    issuerBaseURL: `https://${domain}/`,
    audience,
  });
  return productionMiddleware(req, res, next);
}

async function resolveIdentity(
  req: Request,
  res: Response,
  next: NextFunction,
  options: Parameters<typeof createAuth0Middleware>[0],
) {
  try {
    // UserInfo is bound to the verified API access token; never accept browser profile fields.
    const response = await (options.profileFetch ?? fetch)(
      new URL("userinfo", options.issuerBaseURL).href,
      {
        headers: { Authorization: `Bearer ${req.auth!.token}` },
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error(`Auth0 profile unavailable (${response.status})`);
    const profile = (await response.json()) as Record<string, unknown>;
    if (profile.sub !== req.auth!.payload.sub)
      throw new Error("Auth0 subject mismatch");
    const string = (value: unknown) =>
      typeof value === "string" ? value : null;
    const user = await (options.syncIdentity ?? syncAuth0Identity)({
      id: req.auth!.payload.sub!,
      email: string(profile.email),
      firstName: string(profile.given_name),
      lastName: string(profile.family_name),
      profileImageUrl: string(profile.picture),
      emailVerified: profile.email_verified === true,
    });
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      emailVerified: user.emailVerifiedAt != null,
    };
    next();
  } catch (err) {
    if (err instanceof IdentityLinkRequiredError) {
      res.status(409).json({
        error: "account_link_required",
        message:
          "Your existing Kindred account needs to be linked. Contact support to retain your history.",
      });
      return;
    }
    // Never log a bearer token or the identity response.
    logger.warn(
      { errorName: err instanceof Error ? err.name : "UnknownError" },
      "Auth0 identity resolution failed",
    );
    res.status(503).json({ error: "Authentication temporarily unavailable" });
  }
}
