import express, { Router, type IRouter } from "express";
import { env, isProd } from "../../lib/env";
import { stripe } from "../../integrations/stripe";
import { handleStripeEvent } from "../../services/stripeWebhook";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const stripeHandler = async (req: express.Request, res: express.Response) => {
  try {
    let event;
    const sig = req.get("stripe-signature");
    if (stripe && env.stripeWebhookSecret && sig) {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        env.stripeWebhookSecret,
      );
    } else {
      // Production must always verify. Fail closed.
      if (isProd) {
        logger.error(
          {
            hasStripe: Boolean(stripe),
            hasSecret: Boolean(env.stripeWebhookSecret),
            hasSig: Boolean(sig),
          },
          "stripe webhook missing signature or secret in production — rejecting",
        );
        res.status(400).json({
          error: {
            code: "signature_required",
            message: "Stripe webhook signature verification is required in production.",
          },
        });
        return;
      }
      // Dev only: parse JSON directly so the smoke script + manual testing work.
      event = JSON.parse((req.body as Buffer).toString("utf8"));
    }
    const result = await handleStripeEvent(event);
    res.json({ received: true, processed: result.processed });
  } catch (err) {
    logger.error({ err }, "stripe webhook error");
    res.status(400).json({
      error: { code: "webhook_error", message: err instanceof Error ? err.message : String(err) },
    });
  }
};

// Stripe needs the raw body to verify signatures.
// Mount under both the spec path and the legacy path.
router.post(
  ["/stripe/webhook", "/webhooks/stripe"],
  express.raw({ type: "application/json" }),
  stripeHandler,
);

export default router;
