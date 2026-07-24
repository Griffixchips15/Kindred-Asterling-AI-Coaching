import crypto from "crypto";
import { db, emailVerificationTokensTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { sendEmail, isEmailConfigured } from "./resend";
import { logger } from "./logger";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const APP_URL = process.env.APP_PUBLIC_URL || "http://localhost:4000";
const COOLDOWN_MS = 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendVerificationEmail(user: {
  id: string;
  email: string | null;
  firstName?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!user.email) return { sent: false, reason: "no_email" };
  if (!isEmailConfigured()) return { sent: false, reason: "not_configured" };

  // Cooldown: reject if a token was created in the last 60 seconds
  const recentToken = await db
    .select({ id: emailVerificationTokensTable.id })
    .from(emailVerificationTokensTable)
    .where(
      and(
        eq(emailVerificationTokensTable.userId, user.id),
        isNull(emailVerificationTokensTable.usedAt),
      ),
    )
    .orderBy(emailVerificationTokensTable.createdAt)
    .limit(1);

  if (recentToken.length > 0) {
    // Check if the most recent unused token was created very recently
    // by checking if it exists and was created within the cooldown window.
    // We use a simple approach: just check if we created a token in the last 60s.
    const lastCreated = await db.execute<{ created_at: Date }>(
      sql`SELECT created_at FROM email_verification_tokens
          WHERE user_id = ${user.id} AND used_at IS NULL
          ORDER BY created_at DESC LIMIT 1`,
    );
    const row = lastCreated.rows?.[0];
    if (row?.created_at) {
      const age = Date.now() - new Date(row.created_at).getTime();
      if (age < COOLDOWN_MS) {
        return { sent: false, reason: "cooldown" };
      }
    }
  }

  // Invalidate existing tokens
  await db
    .update(emailVerificationTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailVerificationTokensTable.userId, user.id),
        isNull(emailVerificationTokensTable.usedAt),
      ),
    );

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(emailVerificationTokensTable).values({
    userId: user.id,
    token: tokenHash,
    expiresAt,
  });

  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const safeName = escapeHtml(user.firstName || "there");
  const html = `
    <p>Hi ${safeName},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyUrl}">Verify Email</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you didn't create an account, you can ignore this email.</p>
  `;
  const text = `Verify your email: ${verifyUrl}`;

  const sent = await sendEmail(user.email, "Verify your Kindred account", text, html);
  if (!sent) {
    logger.error({ userId: user.id }, "Failed to send verification email");
    return { sent: false, reason: "send_failed" };
  }

  return { sent: true };
}
