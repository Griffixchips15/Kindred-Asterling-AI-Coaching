import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { db, usersTable, emailVerificationTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { getSessionId, getSession, updateSession } from "../lib/auth";
import { sendVerificationEmail } from "../lib/verifyEmail";

const router: IRouter = Router();

router.post("/auth/send-verification", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (user.emailVerifiedAt) {
    res.json({ message: "Email already verified" });
    return;
  }

  const result = await sendVerificationEmail(user);

  if (result.reason === "not_configured") {
    res.status(503).json({ error: "Email service not configured" });
    return;
  }
  if (result.reason === "cooldown") {
    res.json({ message: "Verification email already sent recently" });
    return;
  }
  if (!result.sent) {
    res.status(500).json({ error: "Failed to send email" });
    return;
  }

  res.json({ message: "Verification email sent" });
});

router.post("/auth/verify-email", async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token required" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const [row] = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(
      and(
        eq(emailVerificationTokensTable.token, tokenHash),
        isNull(emailVerificationTokensTable.usedAt),
        gt(emailVerificationTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(400).json({ error: "Invalid or expired token" });
    return;
  }

  await db
    .update(emailVerificationTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokensTable.id, row.id));

  await db
    .update(usersTable)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(usersTable.id, row.userId));

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session?.user?.id === row.userId) {
      session.user.emailVerifiedAt = new Date();
      await updateSession(sid, session);
    }
  }

  res.json({ message: "Email verified" });
});

export default router;
