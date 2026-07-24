import crypto from "node:crypto";
import { logger } from "./logger";

export function isHelcimConfigured(): boolean {
  return Boolean(process.env.HELCIM_API_KEY);
}

export function isCheckoutConfigured(): boolean {
  return Boolean(
    process.env.HELCIM_API_KEY &&
      process.env.HELCIM_YEARLY_PLAN_ID &&
      process.env.HELCIM_LIFETIME_PRODUCT_ID,
  );
}

/**
 * Verify a Helcim webhook signature using HMAC-SHA256.
 *
 * Helcim sends three headers:
 *   webhook-id        – unique event ID
 *   webhook-timestamp – unix timestamp
 *   webhook-signature  – "v1,<base64-hmac>"
 *
 * The signed content is: `${webhook-id}.${webhook-timestamp}.${body}`
 * The HMAC key is the base64-decoded verifier token.
 */
export function verifyHelcimWebhook(
  rawBody: string,
  headers: {
    "webhook-id"?: string;
    "webhook-timestamp"?: string;
    "webhook-signature"?: string;
  },
): boolean {
  const secret = process.env.HELCIM_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("HELCIM_WEBHOOK_SECRET not configured — rejecting webhook");
    return false;
  }

  const webhookId = headers["webhook-id"];
  const webhookTimestamp = headers["webhook-timestamp"];
  const webhookSignature = headers["webhook-signature"];

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    logger.warn("Missing Helcim webhook headers");
    return false;
  }

  // Reject webhooks older than 5 minutes to prevent replay attacks
  const timestampAge = Math.abs(Date.now() / 1000 - Number(webhookTimestamp));
  if (timestampAge > 300) {
    logger.warn({ timestampAge }, "Helcim webhook timestamp too old");
    return false;
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;

  // Base64-decode the verifier token to get the HMAC key
  const keyBytes = Buffer.from(secret, "base64");

  const expectedSignature = crypto
    .createHmac("sha256", keyBytes)
    .update(signedContent)
    .digest("base64");

  // The signature header may contain multiple space-delimited signatures.
  // Strip the "v1," prefix from each and compare using timing-safe comparison.
  const expectedBuf = Buffer.from(expectedSignature, "base64");
  const signatures = webhookSignature.split(" ");
  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts.length === 2) {
      const candidateBuf = Buffer.from(parts[1], "base64");
      if (
        candidateBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(candidateBuf, expectedBuf)
      ) {
        return true;
      }
    }
  }

  logger.warn("Helcim webhook signature mismatch");
  return false;
}

export type CheckoutPlan = "yearly" | "lifetime";

export type HelcimEventType =
  | "checkout.completed"
  | "subscription.created"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "subscription.expired"
  | "invoice.paid"
  | "invoice.payment_failed";

export interface HelcimWebhookEvent {
  eventType: HelcimEventType;
  customerId?: string;
  customerEmail?: string;
  subscriptionId?: string;
  planId?: string;
  data?: Record<string, unknown>;
}

/**
 * Parse the relevant fields from a Helcim webhook payload.
 */
export function parseHelcimEvent(body: Record<string, unknown>): HelcimWebhookEvent {
  const eventType = (body.eventType ?? body.event_type ?? "") as string;
  const data = (body.data ?? {}) as Record<string, unknown>;
  const customer = (data.customer ?? body.customer ?? {}) as Record<string, unknown>;

  return {
    eventType: eventType as HelcimEventType,
    customerId: (customer.id ?? data.customerId) as string | undefined,
    customerEmail: (customer.email ?? data.customerEmail ?? data.email) as string | undefined,
    subscriptionId: (data.subscriptionId ?? data.subscription_id) as string | undefined,
    planId: (data.planId ?? data.plan_id) as string | undefined,
    data,
  };
}

/**
 * Look up a customer's email from Helcim by customer ID.
 */
export async function getHelcimCustomerEmail(
  customerId: string,
): Promise<string | null> {
  const apiKey = process.env.HELCIM_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api.helcim.com/v2/customers/${customerId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { email?: string } };
    return json.data?.email ?? null;
  } catch (err) {
    logger.error({ err }, "Helcim getCustomerEmail failed");
    return null;
  }
}
