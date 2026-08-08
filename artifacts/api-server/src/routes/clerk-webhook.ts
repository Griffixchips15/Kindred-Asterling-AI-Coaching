import { Router, type IRouter, type Request, type Response } from "express";
import { Webhook } from "svix";
import { logger } from "../lib/logger";
import {
  markClerkIdentityDeleted,
  syncClerkIdentity,
} from "../lib/clerkIdentity";

const router: IRouter = Router();

interface ClerkWebhookPayload {
  type: string;
  data: {
    id: string;
    primary_email_address_id?: string | null;
    email_addresses?: {
      id: string;
      email_address: string;
      verification?: { status?: string };
    }[];
    first_name?: string;
    last_name?: string;
    image_url?: string;
    deleted?: boolean;
  };
}

router.post("/clerk/webhook", async (req: Request, res: Response) => {
  const svixId = req.header("svix-id");
  const svixTimestamp = req.header("svix-timestamp");
  const svixSignature = req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Missing Svix headers" });
    return;
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Webhook secret not configured" });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: "Raw request body required" });
    return;
  }

  let payload: ClerkWebhookPayload;
  try {
    const wh = new Webhook(secret);
    const msg = wh.verify(rawBody.toString("utf8"), {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookPayload;
    payload = msg;
  } catch (err) {
    logger.warn({ err }, "Clerk webhook signature verification failed");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  try {
    const { type, data } = payload;

    switch (type) {
      case "user.created":
      case "user.updated": {
        await syncClerkIdentity({
          id: data.id,
          primaryEmailAddressId: data.primary_email_address_id,
          emailAddresses: data.email_addresses?.map((address) => ({
            id: address.id,
            emailAddress: address.email_address,
            verification: address.verification,
          })),
          firstName: data.first_name,
          lastName: data.last_name,
          imageUrl: data.image_url,
        });
        logger.info({ userId: data.id, type }, "Clerk user synced");
        break;
      }

      case "user.deleted": {
        await markClerkIdentityDeleted(data.id);
        logger.info({ userId: data.id, type }, "Clerk user deleted");
        break;
      }

      default:
        logger.info({ type }, "Clerk webhook event ignored");
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Clerk webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
