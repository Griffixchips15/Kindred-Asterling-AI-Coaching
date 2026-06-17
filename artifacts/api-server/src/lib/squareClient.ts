import crypto from "node:crypto";
import { logger } from "./logger";

// Square's REST API is not a first-party Replit integration, so we talk to it
// directly. Production and sandbox have different hosts; default to production
// because the merchant store is live.
const SQUARE_API_VERSION = "2025-01-23";

function getBaseUrl(): string {
  const env = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
  return env === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

export function isSquareConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN);
}

export interface SquareSubscriptionResult {
  active: boolean;
  squareCustomerId: string | null;
  squareSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}

const INACTIVE: SquareSubscriptionResult = {
  active: false,
  squareCustomerId: null,
  squareSubscriptionId: null,
  currentPeriodEnd: null,
};

async function squarePost(path: string, body: unknown): Promise<any> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not configured");
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Square-Version": SQUARE_API_VERSION,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Square ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

function parsePeriodEnd(sub: any): Date | null {
  const raw = sub?.charged_through_date || null;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Look up whether the given email has an active Square subscription. Identity is
// matched by email only — the email the user signs in with must equal the email
// they paid with on Square.
export async function getActiveSubscriptionByEmail(
  email: string,
): Promise<SquareSubscriptionResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return INACTIVE;

  const custData = await squarePost("/v2/customers/search", {
    limit: 10,
    query: { filter: { email_address: { exact: normalized } } },
  });
  const customers: any[] = Array.isArray(custData?.customers)
    ? custData.customers
    : [];
  const customerIds = customers
    .map((c) => c?.id)
    .filter((id): id is string => typeof id === "string")
    .slice(0, 10);
  if (customerIds.length === 0) return INACTIVE;

  const subData = await squarePost("/v2/subscriptions/search", {
    limit: 50,
    query: { filter: { customer_ids: customerIds } },
  });
  const subs: any[] = Array.isArray(subData?.subscriptions)
    ? subData.subscriptions
    : [];
  const activeSub = subs.find(
    (s) => String(s?.status).toUpperCase() === "ACTIVE",
  );
  if (!activeSub) {
    return { ...INACTIVE, squareCustomerId: customerIds[0] ?? null };
  }
  return {
    active: true,
    squareCustomerId: activeSub.customer_id ?? customerIds[0] ?? null,
    squareSubscriptionId: activeSub.id ?? null,
    currentPeriodEnd: parsePeriodEnd(activeSub),
  };
}

// Resolve a Square customer's email from their id (used by the webhook, which
// only carries a customer_id, to map an event back to one of our users).
export async function getCustomerEmail(
  customerId: string,
): Promise<string | null> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `${getBaseUrl()}/v2/customers/${encodeURIComponent(customerId)}`,
      {
        method: "GET",
        headers: {
          "Square-Version": SQUARE_API_VERSION,
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const email = data?.customer?.email_address;
    return typeof email === "string" ? email : null;
  } catch (err) {
    logger.error({ err }, "Square getCustomerEmail failed");
    return null;
  }
}

// Verify a Square webhook signature. Square signs HMAC-SHA256 over
// (notificationUrl + rawBody), base64-encoded, in the
// `x-square-hmacsha256-signature` header.
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  notificationUrl: string,
): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signature) return false;
  const bodyStr =
    typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const expected = crypto
    .createHmac("sha256", key)
    .update(notificationUrl + bodyStr)
    .digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
