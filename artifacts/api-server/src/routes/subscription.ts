import { Router, type IRouter, type Request } from "express";
import { sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetSubscriptionStatusResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveSubscription } from "../lib/subscriptionService";
import {
  getCustomerEmail,
  verifyWebhookSignature,
} from "../lib/squareClient";

const router: IRouter = Router();

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
      subscribeUrl: process.env.SQUARE_STORE_URL || null,
    });
    res.json(data);
  },
);

function webhookNotificationUrl(req: Request): string {
  return (
    process.env.SQUARE_WEBHOOK_URL ||
    `${req.protocol}://${req.get("host")}${req.originalUrl}`
  );
}

// Square calls this when a subscription is created/updated/canceled or an
// invoice is paid. No session auth — authenticity is the HMAC signature. We map
// the event's customer to one of our users by email and refresh their status.
router.post("/square/webhook", async (req, res): Promise<void> => {
  const signature = req.header("x-square-hmacsha256-signature");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const payloadForSig = rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (
    !verifyWebhookSignature(
      payloadForSig,
      signature,
      webhookNotificationUrl(req),
    )
  ) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  try {
    const obj = (req.body?.data?.object ?? {}) as Record<string, any>;
    const customerId: string | null =
      obj?.subscription?.customer_id ||
      obj?.invoice?.primary_recipient?.customer_id ||
      null;
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
    req.log.error({ err }, "square webhook processing failed");
  }

  // Always 200 after a valid signature so Square stops retrying.
  res.json({ received: true });
});

export default router;
