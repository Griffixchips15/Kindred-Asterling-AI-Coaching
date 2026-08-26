import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { calendarConnectionsTable, db } from "@workspace/db";
import { logger } from "./logger";

type GoogleEventDateTime = { date?: string; dateTime?: string };
type GoogleEvent = {
  summary?: string;
  status?: string;
  start?: GoogleEventDateTime;
};
type GoogleEventsResponse = { items?: GoogleEvent[] };
type GoogleTokenResponse = { access_token?: string; refresh_token?: string };

export type NormalizedCalendarEvent = { date: string; time: string; title: string };

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = (process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${process.env.APP_PUBLIC_URL || ""}/api/calendar/callback`).replace(/\/$/, "");
  const stateSecret = process.env.CALENDAR_OAUTH_STATE_SECRET?.trim();
  const encryptionSecret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim();
  if (!clientId || !clientSecret || !redirectUri || !stateSecret || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, stateSecret, encryptionSecret };
}

export function isCalendarConfigured(): boolean {
  return config() !== null;
}

function key(secret: string): Buffer {
  return createHmac("sha256", secret).update("kindred-calendar-token").digest();
}

function encrypt(value: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string, secret: string): string {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid calendar token");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createOAuthState(userId: string): string {
  const settings = config();
  if (!settings) throw new Error("Google Calendar is not configured");
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", settings.stateSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string): string {
  const settings = config();
  if (!settings) throw new Error("Google Calendar is not configured");
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("Invalid calendar OAuth state");
  const expected = createHmac("sha256", settings.stateSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid calendar OAuth state");
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; expiresAt?: number };
  if (!parsed.userId || !parsed.expiresAt || parsed.expiresAt < Date.now()) throw new Error("Expired calendar OAuth state");
  return parsed.userId;
}

export function googleAuthorizationUrl(state: string): string {
  const settings = config();
  if (!settings) throw new Error("Google Calendar is not configured");
  const params = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.events.readonly",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function saveAuthorizationCode(userId: string, code: string): Promise<void> {
  const settings = config();
  if (!settings) throw new Error("Google Calendar is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      redirect_uri: settings.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`);
  const token = (await response.json()) as GoogleTokenResponse;
  if (!token.refresh_token) throw new Error("Google did not return a refresh token");
  await db
    .insert(calendarConnectionsTable)
    .values({ userId, encryptedRefreshToken: encrypt(token.refresh_token, settings.encryptionSecret) })
    .onConflictDoUpdate({
      target: calendarConnectionsTable.userId,
      set: { encryptedRefreshToken: encrypt(token.refresh_token, settings.encryptionSecret), updatedAt: new Date() },
    });
}

export async function hasCalendarConnection(userId: string): Promise<boolean> {
  const [connection] = await db
    .select({ userId: calendarConnectionsTable.userId })
    .from(calendarConnectionsTable)
    .where(eq(calendarConnectionsTable.userId, userId))
    .limit(1);
  return Boolean(connection);
}

export async function disconnectCalendar(userId: string): Promise<void> {
  const [connection] = await db
    .select({
      encryptedRefreshToken: calendarConnectionsTable.encryptedRefreshToken,
    })
    .from(calendarConnectionsTable)
    .where(eq(calendarConnectionsTable.userId, userId))
    .limit(1);

  if (!connection) return;

  try {
    const encryptionSecret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim();
    if (!encryptionSecret) {
      logger.warn(
        { userId },
        "Calendar token could not be revoked because token encryption is not configured",
      );
    } else {
      const refreshToken = decrypt(
        connection.encryptedRefreshToken,
        encryptionSecret,
      );
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
      });
      if (!response.ok) {
        logger.warn(
          { status: response.status, userId },
          "Google Calendar token revocation failed",
        );
      }
    }
  } catch (err) {
    logger.warn({ err, userId }, "Google Calendar token revocation failed");
  } finally {
    // Deleting the encrypted token is unconditional: a provider outage must
    // not prevent the user from immediately disconnecting Kindred locally.
    await db
      .delete(calendarConnectionsTable)
      .where(eq(calendarConnectionsTable.userId, userId));
  }
}

async function accessToken(userId: string): Promise<string | null> {
  const settings = config();
  if (!settings) return null;
  const [connection] = await db
    .select()
    .from(calendarConnectionsTable)
    .where(eq(calendarConnectionsTable.userId, userId))
    .limit(1);
  if (!connection) return null;
  const refreshToken = decrypt(connection.encryptedRefreshToken, settings.encryptionSecret);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Google token refresh failed (${response.status})`);
  const token = (await response.json()) as GoogleTokenResponse;
  return token.access_token ?? null;
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export async function fetchUpcomingEvents(userId: string, daysAhead: number): Promise<NormalizedCalendarEvent[]> {
  const token = await accessToken(userId);
  if (!token) return [];
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead + 1);
  end.setHours(0, 0, 0, 0);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    logger.warn({ status: response.status, userId }, "Google Calendar API request failed");
    throw new Error(`Google Calendar API returned ${response.status}`);
  }
  const body = (await response.json()) as GoogleEventsResponse;
  return (body.items ?? [])
    .filter((event) => event.status !== "cancelled" && (event.start?.dateTime || event.start?.date))
    .map((event) => {
      if (event.start?.dateTime) {
        const date = new Date(event.start.dateTime);
        return { date: formatLocalDate(date), time: formatLocalTime(date), title: event.summary?.trim() || "(no title)" };
      }
      return { date: event.start!.date!, time: "All day", title: event.summary?.trim() || "(no title)" };
    });
}
