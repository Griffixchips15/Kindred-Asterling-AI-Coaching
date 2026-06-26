import { logger } from "./logger";

// Twilio SMS helper. Auth is the classic Account SID + Auth Token pair stored as
// secrets (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN); the "from" number is
// TWILIO_PHONE_NUMBER. We call the REST API directly (no SDK) so the surface
// stays small and easy to audit. When the secrets are missing, isSmsConfigured()
// returns false and the scheduler simply skips SMS.

const API_BASE = "https://api.twilio.com/2010-04-01";

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

// Best-effort normalization to E.164. Strips spaces/dashes/parens; if the result
// is a bare 10-digit number we assume US/Canada and prepend +1. Anything already
// starting with + is passed through untouched.
export function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Send an SMS. Returns true on success, false on failure (failures are logged,
 * never thrown, so a single bad send can't crash the scheduler).
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    logger.warn("sendSms called but Twilio is not configured");
    return false;
  }

  const auth = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const form = new URLSearchParams({ To: toE164(to), From: from, Body: body });

  try {
    const res = await fetch(`${API_BASE}/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      // Bound the request so one hung send can't stall the every-minute tick.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error(
        { status: res.status, detail: detail.slice(0, 300) },
        "Twilio send SMS failed",
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Twilio send SMS threw");
    return false;
  }
}
