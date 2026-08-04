import { Router, type IRouter, type Request, type Response } from "express";
import { Webhook } from "svix";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface ClerkWebhookPayload {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string; verification: { status: string } }[];
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
        const email = data.email_addresses?.[0]?.email_address ?? null;
        const emailVerified =
          data.email_addresses?.[0]?.verification?.status === "verified";
        await db
          .insert(usersTable)
          .values({
            id: data.id,
            email,
            firstName: data.first_name ?? null,
            lastName: data.last_name ?? null,
            profileImageUrl: data.image_url ?? null,
            emailVerifiedAt: emailVerified ? new Date() : null,
          })
          .onConflictDoUpdate({
            target: usersTable.id,
            set: {
              email,
              firstName: data.first_name ?? null,
              lastName: data.last_name ?? null,
              profileImageUrl: data.image_url ?? null,
              emailVerifiedAt: emailVerified ? new Date() : null,
            },
          });
        logger.info({ userId: data.id, type }, "Clerk user synced");
        break;
      }

      case "user.deleted": {
        await db.delete(usersTable).where(eq(usersTable.id, data.id));
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
