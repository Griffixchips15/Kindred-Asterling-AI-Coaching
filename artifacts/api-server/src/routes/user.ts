import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { ownerIds } from "../lib/subscriptionService";

const router: IRouter = Router();

interface PublicUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  preferredName: string | null;
  birthday: string | null;
  struggles: string | null;
  strengths: string | null;
  interests: string | null;
  bio: string | null;
  motivationalQuote: string | null;
  phone: string | null;
  timezone: string | null;
  emailVerifiedAt: string | null;
  onboardedAt: string | null;
  createdAt: string;
  isOwner: boolean;
}

router.get("/auth/user", requireAuth, async (req: Request, res: Response) => {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id));

  if (!row) {
    res.json({ user: null });
    return;
  }

  const { passwordHash: _ph, ...user } = row;
  const publicUser: PublicUser = {
    ...user,
    createdAt: user.createdAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    onboardedAt: user.onboardedAt?.toISOString() ?? null,
    birthday: user.birthday ?? null,
    isOwner: ownerIds().has(user.id),
  };

  res.json({ user: publicUser });
});

export default router;
