import { Router, type IRouter, type Request } from "express";
import { sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetSubscriptionStatusResponse,
  CreateCheckoutBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveSubscription } from "../lib/subscriptionService";
import {
  getCustomerEmail,
  verifyWebhookSignature,
  isCheckoutConfigured,
  createSubscriptionCheckoutSession,
} from "../lib/stripeClient";

const router: IRouter = Router();

// Where Stripe sends the buyer after a successful payment. Prefer the public
// deployment domain; fall back to the request origin (covers dev previews).
function paymentSuccessUrl(req: Request): string {
  const explicit = process.env.APP_PUBLIC_URL?.replace(/\/$/, "");
  if (explicit) return `${explicit}/payment-success`;
  const domain = (process.env.REPLIT_DOMAINS || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)[0];
  if (domain) return `https://${domain}/payment-success`;
  const origin =
    req.get("origin") || `${req.protocol}://${req.get("host") ?? ""}`;
  return `${origin.replace(/\/$/, "")}/payment-success`;
}

// Read the current user's access status. Always returns 200 (active true/false)
// so the frontend paywall can render — it is NOT gated by requireSubscription.
router.get(
  "/subscription/status",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const status = await resolveSubscription(
      { id: user.id, email: user.email },
      { forceRefresh: true },
    );
    const data = GetSubscriptionStatusResponse.parse({
      active: status.active,
      status: status.status,
      currentPeriodEnd: status.currentPeriodEnd,
      subscribeUrl: null,
    });
    res.json(data);
  },
);

// Create a Stripe Checkout Session for the chosen plan. Requires auth so the
// buyer email is the signed-in email (entitlement is matched by email), which
// also keeps this billable external call off anonymous traffic.
router.post(
  "/subscription/checkout",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CreateCheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!isCheckoutConfigured()) {
      res.status(503).json({ error: "Checkout is not configured yet." });
      return;
    }
    try {
      const { url } = await createSubscriptionCheckoutSession({
        planType: parsed.data.planType,
        buyerEmail: req.user!.email ?? null,
        buyerId: req.user!.id,
        redirectUrl: paymentSuccessUrl(req),
      });
      res.json({ checkoutUrl: url });
    } catch (err) {
      req.log.error({ err }, "stripe checkout session creation failed");
      res.status(502).json({ error: "Could not start checkout." });
    }
  },
);

// Stripe calls this when a subscription is created/updated/canceled or an
// invoice is paid. No session auth — authenticity is the Stripe signature. We
// map the event's customer to one of our users by email and refresh their status.
router.post("/stripe/webhook", async (req, res): Promise<void> => {
  const signature = req.header("stripe-signature");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const payloadForSig = rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

  if (!verifyWebhookSignature(payloadForSig, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  try {
    const event = req.body;
    let customerId: string | null = null;

    if (
      event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const obj = event.data?.object;
      customerId = obj?.customer ?? null;
    } else if (event.type === "invoice.payment_succeeded") {
      customerId = event.data?.object?.customer ?? null;
    }

    if (customerId) {
      const email = await getCustomerEmail(customerId);
      if (email) {
        const [u] = await db
          .select()
          .from(usersTable)
          .where(sql`lower(${usersTable.email}) = ${email.trim().toLowerCase()}`)
          .limit(1);
        if (u) {
          await resolveSubscription(
            { id: u.id, email: u.email },
            { forceRefresh: true },
          );
        }
      }
    }
  } catch (err) {
    req.log.error({ err }, "stripe webhook processing failed");
  }

  // Always 200 after a valid signature so Stripe stops retrying.
  res.json({ received: true });
});

export default router;
