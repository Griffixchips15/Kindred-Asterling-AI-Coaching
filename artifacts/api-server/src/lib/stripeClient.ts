import Stripe from "stripe";
import { logger } from "./logger";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    stripeInstance = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  }
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isCheckoutConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_YEARLY_PRICE_ID &&
      process.env.STRIPE_LIFETIME_PRICE_ID,
  );
}

export type CheckoutPlan = "yearly" | "lifetime";

export async function createSubscriptionCheckoutSession(params: {
  planType: CheckoutPlan;
  buyerEmail: string | null;
  buyerId: string;
  redirectUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const priceId =
    params.planType === "yearly"
      ? process.env.STRIPE_YEARLY_PRICE_ID
      : process.env.STRIPE_LIFETIME_PRICE_ID;
  if (!priceId) throw new Error("Stripe price ID is not configured");

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: params.planType === "yearly" ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: params.buyerEmail ?? undefined,
    client_reference_id: params.buyerId,
    success_url: params.redirectUrl,
    cancel_url: params.redirectUrl.replace("/payment-success", "/pricing"),
    metadata: { userId: params.buyerId },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { sessionId: session.id, url: session.url };
}

export interface StripeSubscriptionResult {
  active: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}

const INACTIVE: StripeSubscriptionResult = {
  active: false,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
};

export async function getActiveSubscriptionByEmail(
  email: string,
): Promise<StripeSubscriptionResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return INACTIVE;

  const stripe = getStripe();

  // Find customer by email
  const customers = await stripe.customers.list({ email: normalized, limit: 5 });
  if (customers.data.length === 0) return INACTIVE;

  const customerId = customers.data[0].id;

  // Check for active subscriptions
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 5,
  });

  const activeSub = subs.data[0];
  if (!activeSub) {
    return { ...INACTIVE, stripeCustomerId: customerId };
  }

  const periodEnd = (activeSub as any).current_period_end;
  return {
    active: true,
    stripeCustomerId: customerId,
    stripeSubscriptionId: activeSub.id,
    currentPeriodEnd: periodEnd
      ? new Date(periodEnd * 1000)
      : null,
  };
}

export async function getCustomerEmail(
  customerId: string,
): Promise<string | null> {
  const stripe = getStripe();
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("email" in customer && typeof customer.email === "string") {
      return customer.email;
    }
    return null;
  } catch (err) {
    logger.error({ err }, "Stripe getCustomerEmail failed");
    return null;
  }
}

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  try {
    getStripe().webhooks.constructEvent(bodyStr, signature, secret);
    return true;
  } catch {
    return false;
  }
}
