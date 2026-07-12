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
}): SessionData {
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    access_token: "session",
  };
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
  res.json({ user: row ? JSON.parse(JSON.stringify(row)) : null });
});

router.post("/auth/register", async (req: Request, res: Response) => {
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
  res.status(201).json({ user: JSON.parse(JSON.stringify(user)) });
});

router.post("/auth/login", async (req: Request, res: Response) => {
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
  res.json({ user: JSON.parse(JSON.stringify(user)) });
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

export default router;
