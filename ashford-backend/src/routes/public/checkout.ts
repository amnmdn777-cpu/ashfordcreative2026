import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  TIERS,
  TierKey,
  computeMonthlyCents,
  computeSetupCents,
} from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { badRequest } from "../../lib/errors";
import { env } from "../../lib/env";
import {
  createCheckoutSession,
  resolveCustomerByEmail,
  stripe,
  TAX_BEHAVIOR_EXCLUSIVE,
  TAX_CODE_SAAS,
  TAX_CODE_SAAS_SETUP,
} from "../../integrations/stripe";

const router: IRouter = Router();

const SelfServeBody = z.object({
  tierKey: TierKey,
  customerEmail: z.string().email().optional(),
  locale: z.enum(["en", "es"]).optional(),
});

/**
 * Self-serve checkout from the public Pricing page.
 *
 * Tier-based: tierKey selects one of boutique / boutique_pro / boutique_concierge.
 * The price + setup are read from TIERS; there are no à-la-carte addons.
 *
 *   - No `repId` is attached, so the Stripe webhook attribution path leaves
 *     `sales.repId = NULL` unless the customer's email/phone happens to match
 *     a lead already claimed by a rep.
 *   - `metadata.source = "self_serve"` so we can distinguish in reporting.
 *   - `metadata.locale` is propagated to the welcome email (EN/ES).
 *   - In dev (no Stripe key) `createCheckoutSession` returns a mock URL.
 */
router.post(
  "/checkout/self-serve",
  asyncHandler(async (req, res) => {
    const body = SelfServeBody.parse(req.body);
    const monthlyTotalCents = computeMonthlyCents(body.tierKey);
    const setupCents = computeSetupCents(body.tierKey);
    const tierLabel = TIERS[body.tierKey].label;

    const successUrl = `${env.publicBaseUrl}/checkout/success`;
    const cancelUrl = `${env.publicBaseUrl}/pricing`;

    if (!stripe) {
      const result = await createCheckoutSession({
        tierKey: body.tierKey,
        monthlyTotalCents,
        setupCents,
        customerEmail: body.customerEmail,
        successUrl,
        cancelUrl,
      });
      res.json({
        url: result.url,
        sessionId: result.sessionId,
        mode: "dev_mock",
        monthlyTotalCents,
        setupCents,
      });
      return;
    }

    const acceptedTermsIp = (req.ip ?? "").slice(0, 64);

    const customerId = body.customerEmail
      ? await resolveCustomerByEmail(stripe, body.customerEmail, {
          tierKey: body.tierKey,
          source: "self_serve",
        })
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        ...(setupCents > 0
          ? [
              {
                price_data: {
                  currency: "usd",
                  unit_amount: setupCents,
                  tax_behavior: TAX_BEHAVIOR_EXCLUSIVE,
                  product_data: {
                    name: `${tierLabel} setup (one-time)`,
                    tax_code: TAX_CODE_SAAS_SETUP,
                  },
                },
                quantity: 1,
              },
            ]
          : []),
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" as const },
            unit_amount: monthlyTotalCents,
            tax_behavior: TAX_BEHAVIOR_EXCLUSIVE,
            product_data: {
              name: `Ashford Creative — ${tierLabel} (monthly)`,
              description:
                "Boutique website + reseller hosting for mental-health practitioners.",
              tax_code: TAX_CODE_SAAS,
            },
          },
          quantity: 1,
        },
      ],
      ...(customerId
        ? { customer: customerId }
        : { customer_email: body.customerEmail }),
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      locale: body.locale === "es" ? "es" : "en",
      ...(process.env.STRIPE_REQUIRE_TOS_CONSENT === "true"
        ? { consent_collection: { terms_of_service: "required" as const } }
        : {}),
      billing_address_collection: "required",
      automatic_tax: {
        enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true",
      },
      ...(customerId
        ? {
            customer_update: {
              address: "auto" as const,
              name: "auto" as const,
            },
          }
        : {}),
      metadata: {
        tierKey: body.tierKey,
        source: "self_serve",
        locale: body.locale ?? "en",
        acceptedTermsIp,
      },
      subscription_data: {
        metadata: {
          tierKey: body.tierKey,
          source: "self_serve",
          locale: body.locale ?? "en",
        },
      },
    });
    if (!session.url) throw badRequest("Stripe did not return a checkout URL");
    res.json({
      url: session.url,
      sessionId: session.id,
      mode: "stripe_checkout",
      monthlyTotalCents,
      setupCents,
    });
  }),
);

export default router;
