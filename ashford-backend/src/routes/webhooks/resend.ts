import express, { Router, type IRouter } from "express";
import { Webhook } from "svix";
import { db, emailMessages, salesReps } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { env, isProd } from "../../lib/env";
import { notify } from "../../services/notifications";

const router: IRouter = Router();

type ResendEvent = {
  type: string;
  data: {
    email_id?: string;
    to?: string | string[];
    subject?: string;
    bounce?: { message?: string; subType?: string };
    complaint?: { feedbackType?: string };
  };
};

const verify = (req: express.Request, raw: Buffer): ResendEvent | null => {
  if (!env.resendWebhookSecret) {
    if (isProd) return null;
    return JSON.parse(raw.toString("utf8")) as ResendEvent;
  }
  try {
    const wh = new Webhook(env.resendWebhookSecret);
    return wh.verify(raw.toString("utf8"), {
      "svix-id": req.get("svix-id") ?? "",
      "svix-timestamp": req.get("svix-timestamp") ?? "",
      "svix-signature": req.get("svix-signature") ?? "",
    }) as ResendEvent;
  } catch (err) {
    logger.warn({ err }, "resend webhook signature invalid");
    return null;
  }
};

// Map Resend event type -> the status we want to persist on `email_messages`.
// We stay within the existing `messageStatusEnum` (no schema migration needed).
const statusFor = (eventType: string): "delivered" | "failed" | null => {
  switch (eventType) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
    case "email.complained":
    case "email.delivery_delayed":
      return "failed";
    default:
      return null;
  }
};

const handler = async (req: express.Request, res: express.Response) => {
  const event = verify(req, req.body as Buffer);
  if (!event) {
    res.status(400).json({ error: { code: "invalid_signature" } });
    return;
  }

  const newStatus = statusFor(event.type);
  if (!newStatus) {
    // Acknowledge unknown / informational event types so Resend stops retrying.
    res.json({ received: true, ignored: true });
    return;
  }

  const resendId = event.data.email_id;
  if (!resendId) {
    res.json({ received: true, ignored: "no email_id" });
    return;
  }

  const [row] = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.resendId, resendId))
    .limit(1);

  // Build a human-readable error blurb for failures so the admin panel can
  // show why each one bounced without having to dig into Resend.
  const errorBlurb =
    event.type === "email.bounced"
      ? `bounced${event.data.bounce?.subType ? ` (${event.data.bounce.subType})` : ""}${event.data.bounce?.message ? `: ${event.data.bounce.message}` : ""}`
      : event.type === "email.complained"
        ? `complained${event.data.complaint?.feedbackType ? ` (${event.data.complaint.feedbackType})` : ""}`
        : event.type === "email.delivery_delayed"
          ? "delivery_delayed"
          : null;

  if (row) {
    // Don't downgrade an already-delivered email back to failed if a delayed
    // event arrives late. Treat `delivered` as terminal-good.
    if (row.status === "delivered" && newStatus === "failed") {
      res.json({ received: true, skipped: "already_delivered" });
      return;
    }
    await db
      .update(emailMessages)
      .set({
        status: newStatus,
        errorMessage: errorBlurb ?? row.errorMessage,
      })
      .where(eq(emailMessages.id, row.id));
  } else {
    logger.warn(
      { resendId, type: event.type },
      "resend webhook for unknown email_id — ignoring",
    );
  }

  // Notify all admins on bounces and complaints so the owner sees deliverability
  // problems before customers complain. Skip the noisier delivery_delayed.
  if (event.type === "email.bounced" || event.type === "email.complained") {
    const recipient = Array.isArray(event.data.to)
      ? event.data.to[0]
      : event.data.to;
    const admins = await db
      .select({ id: salesReps.id })
      .from(salesReps)
      .where(eq(salesReps.role, "admin"));
    await Promise.all(
      admins.map((a) =>
        notify({
          repId: a.id,
          type:
            event.type === "email.bounced" ? "email.bounced" : "email.complained",
          title:
            event.type === "email.bounced"
              ? `Email bounced: ${recipient ?? "unknown recipient"}`
              : `Spam complaint: ${recipient ?? "unknown recipient"}`,
          body: errorBlurb ?? event.type,
          linkUrl: "/dashboard",
        }),
      ),
    );
  }

  res.json({ received: true });
};

// Resend's signature is computed over the raw request body, so we must use
// `express.raw` here (the JSON body parser would mutate the bytes).
router.post(
  "/webhooks/resend",
  express.raw({ type: "application/json" }),
  handler,
);

export default router;
