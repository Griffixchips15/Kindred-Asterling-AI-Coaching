import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  createSession,
  getSessionId,
  hashPassword,
  SESSION_COOKIE,
  SESSION_TTL,
  verifyPassword,
  type SessionData,
} from "../lib/auth";
import { authLimiter } from "../middlewares/rateLimiter";
import { sendVerificationEmail } from "../lib/verifyEmail";
import { isEmailConfigured } from "../lib/resend";

const router: IRouter = Router();

interface AuthBody {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getPassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 8) return null;
  return value;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function toSessionData(user: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  emailVerifiedAt: Date | null;
}): SessionData {
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    access_token: "session",
  };
}

function toPublicUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

async function startSession(
  res: Response,
  user: ReturnType<typeof toSessionData>["user"],
) {
  const sid = await createSession({ user, access_token: "session" });
  setSessionCookie(res, sid);
}

router.get("/auth/user", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    res.json({ user: null });
    return;
  }
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));
  res.json({ user: row ? toPublicUser(row) : null });
});

router.post("/auth/register", authLimiter, async (req: Request, res: Response) => {
  const body = req.body as AuthBody;
  const email = normalizeEmail(body.email);
  const password = getPassword(body.password);

  if (!email || !password) {
    res.status(400).json({
      error: "Email and password of at least 8 characters are required",
    });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      firstName: normalizeOptionalString(body.firstName),
      lastName: normalizeOptionalString(body.lastName),
    })
    .returning();

  await startSession(res, toSessionData(user).user);

  // Fire-and-forget: send verification email (don't block the response)
  if (isEmailConfigured()) {
    sendVerificationEmail(user).catch(() => {});
  }

  res.status(201).json({ user: toPublicUser(user) });
});

router.post("/auth/login", authLimiter, async (req: Request, res: Response) => {
  const body = req.body as AuthBody;
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : null;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (
    !user?.passwordHash ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await startSession(res, toSessionData(user).user);
  res.json({ user: toPublicUser(user) });
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

router.post("/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: "email and password (min 8 chars) required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

export default router;
