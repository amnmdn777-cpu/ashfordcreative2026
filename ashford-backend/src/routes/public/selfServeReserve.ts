import { Router, type IRouter } from "express";
import {
  TIERS,
  TierKey,
  SelfServeTemplateReserveRequest,
  type SelfServeTemplateReserveResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { rateLimit } from "../../middleware/rateLimit";
import { badRequest } from "../../lib/errors";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import {
  createCheckoutSession,
  resolveCustomerByEmail,
  stripe,
  TAX_BEHAVIOR_EXCLUSIVE,
  TAX_CODE_SAAS,
  TAX_CODE_SAAS_SETUP,
} from "../../integrations/stripe";

const router: IRouter = Router();

/**
 * Self-serve reservation initiated from the public template showcase
 * (`/template/:key`). The visitor is anonymous: they fill out email +
 * practice name (+ optional phone + chosen domain) and land in Stripe
 * Checkout in one click — no rep involved, no portal slug.
 *
 * Behavior:
 *   - No `repId` is attached. The Stripe webhook attribution path leaves
 *     `sales.repId = NULL` unless the customer email/phone matches an
 *     existing claimed lead (the existing fallback attribution).
 *   - `metadata.source = "self_serve_template"` distinguishes this funnel
 *     from the Pricing-page self-serve in reporting.
 *   - Add-ons captured here are surfaced as Stripe metadata only — the
 *     existing post-payment webhook chain handles fulfillment & onboarding.
 *   - We deliberately do NOT pre-insert a `leads` row: the leads schema
 *     requires phone/specialty/city/state which an anonymous visitor
 *     usually doesn't provide. The post-payment webhook is the authoritative
 *     place that creates the customer record from real Stripe data.
 *   - Rate-limited to 5 req/min/IP via the standard rateLimit middleware.
 *   - Honeypot field `_hp` must be empty.
 *
 * In dev (no Stripe key) returns mode:"dev_mock" with a checkout-success
 * URL so QA can still click through.
 */
router.post(
  "/public/self-serve-reserve",
  rateLimit({ name: "public_self_serve_reserve", capacity: 5, refillPerSecond: 0.0833 }),
  asyncHandler(async (req, res) => {
    const body = SelfServeTemplateReserveRequest.parse(req.body);

    // Honeypot — bots that auto-fill all visible fields trip this. Real
    // browsers never see the input (display:none) so it stays empty.
    if (body._hp && body._hp.length > 0) {
      logger.warn({ ip: req.ip }, "self-serve-reserve honeypot triggered");
      throw badRequest("Invalid request");
    }

    // Phase 1B-c: the public template showcase is tier-based; reserve
    // calls now carry `tierKey` in the request body. Legacy clients
    // still POSTing `addonSlugs` are tolerated — we ignore the array
    // since tiers don't compose addons — but resolve the price entirely
    // from TIERS. Falls back to `boutique` when the body schema (still
    // shaped for legacy callers via the shim) doesn't carry tierKey yet.
    const tierFromBody = TierKey.safeParse(
      (body as unknown as { tierKey?: string }).tierKey ?? "boutique",
    );
    const tierKey: TierKey = tierFromBody.success
      ? tierFromBody.data
      : "boutique";
    const validAddonKeys: string[] = [];
    const monthlyTotalCents = TIERS[tierKey].monthlyCents;
    const setupTotalCents = TIERS[tierKey].setupCents;

    const successUrl = `${env.publicBaseUrl}/checkout/success`;
    const cancelUrl = `${env.publicBaseUrl}/template/${encodeURIComponent(body.templateKey)}`;

    const customizationsJson = JSON.stringify({
      paletteKey: body.paletteKey ?? null,
      ...body.customizations,
    });

    if (!stripe) {
      const result = await createCheckoutSession({
        tierKey,
        monthlyTotalCents,
        setupCents: setupTotalCents,
        customerEmail: body.contact.email,
        successUrl,
        cancelUrl,
        locale: body.locale,
      });
      logger.info(
        {
          event: "self_serve_reserve_created",
          mode: "dev_mock",
          templateKey: body.templateKey,
          addonsCount: validAddonKeys.length,
          monthlyTotalCents,
        },
        "self-serve template reserve (dev mock)",
      );
      const payload: SelfServeTemplateReserveResponse = {
        mode: "dev_mock",
        url: result.url,
        sessionId: result.sessionId,
        monthlyTotalCents,
        setupTotalCents,
      };
      res.json(payload);
      return;
    }

    const acceptedTermsIp = (req.ip ?? "").slice(0, 64);
    const customerId = await resolveCustomerByEmail(stripe, body.contact.email, {
      source: "self_serve_template",
      templateKey: body.templateKey,
      practiceName: body.contact.practiceName,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" as const },
            unit_amount: monthlyTotalCents,
            tax_behavior: TAX_BEHAVIOR_EXCLUSIVE,
            product_data: {
              name: `Ashford Creative — ${TIERS[tierKey].label} (monthly)`,
              description:
                "Boutique website + reseller hosting for mental-health practitioners.",
              tax_code: TAX_CODE_SAAS,
            },
          },
          quantity: 1,
        },
      ],
      customer: customerId,
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
      customer_update: { address: "auto" as const, name: "auto" as const },
      metadata: {
        tierKey,
        source: "self_serve_template",
        locale: body.locale ?? "en",
        templateKey: body.templateKey,
        paletteKey: body.paletteKey ?? "",
        chosenDomain: body.contact.chosenDomain ?? "",
        practiceName: body.contact.practiceName.slice(0, 192),
        contactPhone: body.contact.phone?.slice(0, 32) ?? "",
        customizations: customizationsJson.slice(0, 480),
        acceptedTermsIp,
        // Funnel join key: lets the admin self-serve funnel report stitch
        // pre-checkout `funnel_events` rows back to this completed sale.
        funnelSessionId: (body.funnelSessionId ?? "").slice(0, 64),
      },
      subscription_data: {
        metadata: {
          tierKey,
          source: "self_serve_template",
          locale: body.locale ?? "en",
          templateKey: body.templateKey,
          chosenDomain: body.contact.chosenDomain ?? "",
          funnelSessionId: (body.funnelSessionId ?? "").slice(0, 64),
        },
      },
    });
    if (!session.url) throw badRequest("Stripe did not return a checkout URL");

    logger.info(
      {
        event: "self_serve_reserve_created",
        mode: "stripe_checkout",
        sessionId: session.id,
        templateKey: body.templateKey,
        paletteKey: body.paletteKey ?? null,
        addonsCount: validAddonKeys.length,
        monthlyTotalCents,
        chosenDomain: body.contact.chosenDomain ?? null,
        practiceName: body.contact.practiceName,
      },
      "self-serve template reserve created",
    );

    const payload: SelfServeTemplateReserveResponse = {
      mode: "stripe_checkout",
      url: session.url,
      sessionId: session.id,
      monthlyTotalCents,
      setupTotalCents,
    };
    res.json(payload);
  }),
);

export default router;
