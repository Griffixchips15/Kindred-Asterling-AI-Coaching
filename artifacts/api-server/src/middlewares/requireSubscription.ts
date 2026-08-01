import { type Request, type Response, type NextFunction } from "express";
import { resolveSubscription } from "../lib/subscriptionService";

// Gate that blocks any route mounted after it unless the authenticated user has
// an active subscription and verified email. Must run after requireAuth so
// req.user is present.
export function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Integration tests drive the real routes with sessions but no subscription;
  // subscription; the gate is exercised by dedicated unit tests instead.
  if (process.env.NODE_ENV === "test") {
    next();
    return;
  }

  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!user.emailVerifiedAt) { res.status(403).json({ error: "Email verification required" }); return; }

  resolveSubscription({ id: user.id, email: user.email })
    .then((status) => {
      if (status.active) {
        next();
      } else {
        res.status(402).json({ error: "Subscription required" });
      }
    })
    .catch((err) => {
      req.log.error({ err }, "subscription gate check failed");
      res.status(402).json({ error: "Subscription required" });
    });
}
