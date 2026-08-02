import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { like, eq, and, isNull, sql } from "drizzle-orm";
import { db, usersTable, betaGrantsTable, entitlementAuditTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { ownerIds } from "../lib/subscriptionService";
import { hashPassword } from "../lib/auth";

function ownerEmails(): Set<string> {
  return new Set(
    (process.env.SUBSCRIPTION_OWNER_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  );
}

function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (ownerIds().has(req.user.id)) {
    next();
    return;
  }
  if (req.user.email && ownerEmails().has(req.user.email.trim().toLowerCase())) {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden" });
  return;
}

const router: IRouter = Router();

router.use("/admin", requireAuth, requireOwner);


router.get("/admin/users", async (req, res): Promise<void> => {
  const q = (req.query.q as string || "").trim().toLowerCase();
  if (!q) {
    res.json({ users: [] });
    return;
  }

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      emailVerifiedAt: usersTable.emailVerifiedAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(like(sql`lower(${usersTable.email})`, `%${q}%`))
    .limit(20);

  res.json({ users });
});

router.get("/admin/beta/grants", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: betaGrantsTable.id,
      userId: betaGrantsTable.userId,
      grantedBy: betaGrantsTable.grantedBy,
      grantedAt: betaGrantsTable.grantedAt,
      expiresAt: betaGrantsTable.expiresAt,
      revokedAt: betaGrantsTable.revokedAt,
      revokedBy: betaGrantsTable.revokedBy,
    })
    .from(betaGrantsTable)
    .orderBy(sql`${betaGrantsTable.grantedAt} DESC`);

  res.json({ grants: rows });
});

router.post("/admin/beta/grant", async (req, res): Promise<void> => {
  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(betaGrantsTable)
    .where(
      and(
        eq(betaGrantsTable.userId, userId),
        isNull(betaGrantsTable.revokedAt),
        sql`(${betaGrantsTable.expiresAt} IS NULL OR ${betaGrantsTable.expiresAt} > NOW())`,
      ),
    )
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "User already has an active beta grant" });
    return;
  }

  const [grant] = await db
    .insert(betaGrantsTable)
    .values({
      userId,
      grantedBy: req.user!.id,
    })
    .returning();

  await db.insert(entitlementAuditTable).values({
    userId,
    action: "beta_granted",
    actorId: req.user!.id,
    metadata: { grantId: grant.id },
  });

  res.status(201).json({ grant });
});

router.post("/admin/beta/revoke", async (req, res): Promise<void> => {
  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [grant] = await db
    .select()
    .from(betaGrantsTable)
    .where(
      and(
        eq(betaGrantsTable.userId, userId),
        isNull(betaGrantsTable.revokedAt),
      ),
    )
    .limit(1);

  if (!grant) {
    res.status(404).json({ error: "No active beta grant found for this user" });
    return;
  }

  await db
    .update(betaGrantsTable)
    .set({
      revokedAt: new Date(),
      revokedBy: req.user!.id,
    })
    .where(eq(betaGrantsTable.id, grant.id));

  await db.insert(entitlementAuditTable).values({
    userId,
    action: "beta_revoked",
    actorId: req.user!.id,
    metadata: { grantId: grant.id },
  });

  res.json({ success: true });
});

export default router;
