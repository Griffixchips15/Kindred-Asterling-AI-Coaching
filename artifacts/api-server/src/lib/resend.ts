import { logger } from "./logger";

// Resend email helper. Auth is a single API key stored as the RESEND_API_KEY
// secret; the "from" address is RESEND_FROM_EMAIL (must be a Resend-verified
// sender/domain, e.g. "Kindred <kindred@yourdomain.com>"). We call the REST API
// directly (no SDK). When the secrets are missing, isEmailConfigured() returns
// false and the scheduler simply skips email.

const API_URL = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Send an email. Returns true on success, false on failure (failures are logged,
 * never thrown, so a single bad send can't crash the scheduler).
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    logger.warn("sendEmail called but Resend is not configured");
    return false;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
      // Bound the request so one hung send can't stall the every-minute tick.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error(
        { status: res.status, detail: detail.slice(0, 300) },
        "Resend send email failed",
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Resend send email threw");
    return false;
  }
}
