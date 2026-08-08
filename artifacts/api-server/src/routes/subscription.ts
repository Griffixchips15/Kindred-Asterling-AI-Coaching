import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  processedWebhooksTable,
  entitlementAuditTable,
} from "@workspace/db";
import {
  GetSubscriptionStatusResponse,
  CreateCheckoutBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveSubscription } from "../lib/subscriptionService";
import { logger } from "../lib/logger";
import { findClerkIdentitiesByEmail } from "../middlewares/authMiddleware";
import {
  verifyHelcimWebhook,
  parseHelcimEvent,
  getHelcimCustomerEmail,
  isCheckoutConfigured as isHelcimCheckoutConfigured,
  type HelcimEventType,
} from "../lib/helcimClient";

function eventToStatus(eventType: HelcimEventType): string {
  switch (eventType) {
    case "checkout.completed":
    case "subscription.created":
    case "subscription.renewed":
    case "invoice.paid":
      return "active";
    case "subscription.cancelled":
      return "active"; // active until period end
    case "subscription.expired":
    case "invoice.payment_failed":
      return "inactive";
    default:
      return "inactive";
  }
}

function extractPeriodEnd(data: Record<string, unknown>): Date | null {
  // Try common field names Helcim might use
  const raw =
    data.currentPeriodEnd ??
    data.current_period_end ??
    data.periodEnd ??
    data.period_end ??
    data.renewalDate ??
    data.renewal_date;
  if (!raw) return null;
  const d = new Date(raw as string | number);
  return isNaN(d.getTime()) ? null : d;
}

const router: IRouter = Router();

// Read the current user's legacy subscription status for billing/account flows.
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
      source: status.source,
      subscribeUrl: null,
    });
    res.json(data);
  },
);

// Redirect to Helcim's hosted subscription page for the chosen plan.
router.post(
  "/subscription/checkout",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CreateCheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!isHelcimCheckoutConfigured()) {
      res.status(503).json({ error: "Checkout is not configured yet." });
      return;
    }

    const planType = parsed.data.planType;
    const url =
      planType === "yearly"
        ? process.env.HELCIM_YEARLY_CHECKOUT_URL
        : process.env.HELCIM_LIFETIME_CHECKOUT_URL;

    if (!url) {
      res
        .status(503)
        .json({ error: `No checkout URL configured for ${planType} plan.` });
      return;
    }

    res.json({ checkoutUrl: url });
  },
);

// Helcim webhook endpoint. Helcim signs payloads with HMAC-SHA256 using a
// per-account verifier token sent in webhook-id / webhook-timestamp / webhook-signature headers.
router.post("/payment/webhook", async (req, res): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const bodyStr = rawBody
    ? rawBody.toString("utf8")
    : JSON.stringify(req.body ?? {});

  const webhookId = req.header("webhook-id");
  const webhookTimestamp = req.header("webhook-timestamp");
  const webhookSignature = req.header("webhook-signature");

  // If no signature headers are present, this is a Helcim URL-verification ping.
  // Return 200 so Helcim accepts the webhook URL.
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    logger.info("Helcim webhook ping (no signature headers) — returning OK");
    res.json({ received: true });
    return;
  }

  const sigResult = verifyHelcimWebhook(bodyStr, {
    "webhook-id": webhookId,
    "webhook-timestamp": webhookTimestamp,
    "webhook-signature": webhookSignature,
  });

  if (!sigResult) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Prevent replay: skip if this event ID was already processed
  const [existing] = await db
    .select({ webhookId: processedWebhooksTable.webhookId })
    .from(processedWebhooksTable)
    .where(eq(processedWebhooksTable.webhookId, webhookId))
    .limit(1);
  if (existing) {
    logger.info({ webhookId }, "Duplicate webhook event — skipping");
    res.json({ received: true });
    return;
  }

  try {
    const event = parseHelcimEvent(req.body);
    let customerId: string | null = event.customerId ?? null;

    if (!customerId && event.data) {
      customerId = (event.data.customerId ?? event.data.customer_id) as
        string | null;
    }

    if (customerId) {
      // Validate event type is known before modifying access
      const allowedEvents: HelcimEventType[] = [
        "checkout.completed",
        "subscription.created",
        "subscription.renewed",
        "subscription.cancelled",
        "subscription.expired",
        "invoice.paid",
        "invoice.payment_failed",
      ];
      if (!allowedEvents.includes(event.eventType)) {
        logger.warn(
          { eventType: event.eventType },
          "Unknown Helcim event type — skipping",
        );
      } else {
        const email =
          event.customerEmail ?? (await getHelcimCustomerEmail(customerId));
        if (email) {
          const [u] = await findClerkIdentitiesByEmail(
            email.trim().toLowerCase(),
          );
          if (u) {
            await db
              .insert(usersTable)
              .values({ id: u.id })
              .onConflictDoNothing();
            const status = eventToStatus(event.eventType);
            const periodEnd = extractPeriodEnd(event.data ?? {});
            const subId = event.subscriptionId ?? null;

            await db
              .insert(subscriptionsTable)
              .values({
                userId: u.id,
                email,
                status,
                paymentCustomerId: customerId,
                paymentSubscriptionId: subId,
                currentPeriodEnd: periodEnd,
                lastCheckedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: subscriptionsTable.userId,
                set: {
                  email,
                  status,
                  paymentCustomerId: customerId,
                  paymentSubscriptionId: subId,
                  currentPeriodEnd: periodEnd,
                  lastCheckedAt: new Date(),
                },
              });

            await db.insert(entitlementAuditTable).values({
              userId: u.id,
              action: `helcim_${event.eventType}`,
              metadata: {
                customerId,
                subscriptionId: subId,
                status,
                periodEnd: periodEnd?.toISOString(),
              },
            });

            logger.info(
              { eventType: event.eventType, userId: u.id, status },
              "Helcim webhook — subscription upserted",
            );
          }
        }
      }
    }

    // Mark event as processed in PostgreSQL
    await db
      .insert(processedWebhooksTable)
      .values({
        webhookId,
        eventType: event.eventType,
      })
      .onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "Helcim webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }

  res.json({ received: true });
});

export default router;
