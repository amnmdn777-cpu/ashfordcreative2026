import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  PreviewEventRequest,
  TemplateKey,
  type PreviewLeadInfo,
  type PreviewResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  getLinkByToken,
  recordLinkEvent,
} from "../../services/prospectLinks";
import { notify } from "../../services/notifications";
import { notFound, badRequest } from "../../lib/errors";
import { hashIp } from "../../lib/tokens";
import { rateLimit } from "../../middleware/rateLimit";
import { env } from "../../lib/env";
import { resolveCustomerByEmail, stripe } from "../../integrations/stripe";
import { logger } from "../../lib/logger";
import { buildPreviewContent } from "../../services/previewContent";
import { runEnrichmentForLead } from "../../integrations/enrichment/orchestrator";
import { shouldAutoEnrichLead } from "../../services/portals";

const router: IRouter = Router();

router.get(
  ["/preview/:token", "/public/preview/:token"],
  asyncHandler(async (req, res) => {
    const token = z.string().min(8).parse(req.params.token);
    const found = await getLinkByToken(token);
    if (!found || !found.lead || !found.rep) throw notFound("Preview link not found.");

    // Log "opened" event the first time the public page is fetched.
    await recordLinkEvent({
      linkId: found.link.id,
      eventType: "opened",
      userAgent: req.get("user-agent")?.slice(0, 256),
      ipHash: hashIp(req.ip),
    });

    const info: PreviewLeadInfo = {
      practice: found.lead.practice,
      name: found.lead.name,
      specialty: found.lead.specialty,
      city: found.lead.city,
      state: found.lead.state,
      phone: found.lead.phone,
      profileBlurb: found.lead.profileBlurb,
      rep: {
        displayName: found.rep.displayName,
        promoCode: found.rep.promoCode,
      },
    };

    // Fire-and-forget enrichment when the lead is overdue for a refresh.
    // We reuse the same `shouldAutoEnrichLead` cooldown gate as the
    // portal so two prospect-facing surfaces can't double-trigger
    // upstream calls, and so leads whose sources soft-failed don't get
    // re-run on every page load.
    const leadId = found.lead.id;
    void shouldAutoEnrichLead(leadId)
      .then((ok) => {
        if (!ok) return;
        return runEnrichmentForLead(leadId, "auto");
      })
      .catch((err) => {
        logger.warn({ err, leadId }, "preview: auto-enrich failed");
      });

    const { content, pages } = await buildPreviewContent(leadId);

    const body: PreviewResponse = { info, content, pagesFromWebsite: pages };
    res.json(body);
  }),
);

router.post(
  ["/preview/:token/event", "/preview/:token/events", "/public/preview/:token/events"],
  rateLimit({ name: "preview_event", capacity: 30, refillPerSecond: 1 }),
  asyncHandler(async (req, res) => {
    const token = z.string().min(8).parse(req.params.token);
    const body = PreviewEventRequest.parse(req.body);
    const found = await getLinkByToken(token);
    if (!found) throw notFound("Preview link not found.");
    // Narrow the discriminated union to extract optional fields by variant.
    const templateKey =
      "templateKey" in body ? body.templateKey : undefined;
    const changeRequestText =
      "changeRequestText" in body ? body.changeRequestText : undefined;
    if (body.eventType === "requested_changes" && !changeRequestText) {
      throw badRequest("changeRequestText is required for requested_changes.");
    }
    await recordLinkEvent({
      linkId: found.link.id,
      eventType: body.eventType,
      templateKey,
      changeRequestText,
      userAgent: req.get("user-agent")?.slice(0, 256),
      ipHash: hashIp(req.ip),
    });

    if (body.eventType === "preferred_template") {
      await notify({
        repId: found.link.repId,
        type: "preview.preferred",
        title: `${found.lead?.practice ?? "Prospect"} chose ${body.templateKey}`,
        body: "They picked a favorite. Time to follow up.",
        linkUrl: `/dashboard/leads/${found.link.leadId}`,
      });
    }
    void changeRequestText;
    if (body.eventType === "requested_changes") {
      await notify({
        repId: found.link.repId,
        type: "preview.changes",
        title: `Changes requested by ${found.lead?.practice}`,
        body: body.changeRequestText?.slice(0, 200),
        linkUrl: `/dashboard/leads/${found.link.leadId}`,
      });
    }
    if (body.eventType === "requested_callback") {
      await notify({
        repId: found.link.repId,
        type: "preview.callback",
        title: `${found.lead?.practice} wants a callback`,
        linkUrl: `/dashboard/leads/${found.link.leadId}`,
      });
    }
    res.json({ ok: true });
  }),
);

const CheckoutRequest = z.object({ templateKey: TemplateKey });

router.post(
  "/preview/:token/checkout",
  rateLimit({ name: "preview_checkout", capacity: 6, refillPerSecond: 0.2 }),
  asyncHandler(async (req, res) => {
    const token = z.string().min(8).parse(req.params.token);
    const { templateKey } = CheckoutRequest.parse(req.body);
    const found = await getLinkByToken(token);
    if (!found || !found.lead || !found.rep) throw notFound("Preview link not found.");

    await recordLinkEvent({
      linkId: found.link.id,
      eventType: "preferred_template",
      templateKey,
      userAgent: req.get("user-agent")?.slice(0, 256),
      ipHash: hashIp(req.ip),
    });

    // Strategy: prefer dynamic Stripe Checkout if priced + Stripe configured.
    // Else: fall back to a configured Payment Link with metadata as query params.
    // Else: return null URL — client will show "rep will follow up" confirmation.
    const successUrl = `${env.publicBaseUrl}/p/${encodeURIComponent(token)}?checkout=success`;
    const cancelUrl = `${env.publicBaseUrl}/p/${encodeURIComponent(token)}?checkout=cancel`;
    const leadIdStr = String(found.lead.id);
    // NB: never put the raw preview token in third-party metadata — it is a
    // bearer credential for an unauthenticated PII page. Use stable internal IDs only.
    // camelCase keys to match the conventions used by `services/stripeWebhook.ts`
    // (which reads `metadata.leadId` / `metadata.repId`). Keep `templateKey` and
    // `repPromoCode` in the same case for consistency.
    const metadata = {
      leadId: leadIdStr,
      templateKey,
      repId: String(found.rep.id),
      repPromoCode: found.rep.promoCode ?? "",
    };

    if (stripe && env.stripePriceMonthly) {
      try {
        // Subscription mode: monthly recurring + one-time setup fee (if priced).
        const lineItems: { price: string; quantity: number }[] = [
          { price: env.stripePriceMonthly, quantity: 1 },
        ];
        if (env.stripePriceSetupA) {
          lineItems.push({ price: env.stripePriceSetupA, quantity: 1 });
        }

        // Look up the rep's promotion code so we can pre-apply it as a discount.
        // `discounts` and `allow_promotion_codes` are mutually exclusive in Stripe,
        // so we apply the rep discount when found, otherwise let the customer enter one.
        let discounts: { promotion_code: string }[] | undefined;
        let allowPromotionCodes: boolean | undefined = true;
        if (found.rep.promoCode) {
          try {
            const lookup = await stripe.promotionCodes.list({
              code: found.rep.promoCode,
              active: true,
              limit: 1,
            });
            const promo = lookup.data[0];
            if (promo) {
              discounts = [{ promotion_code: promo.id }];
              allowPromotionCodes = undefined;
            }
          } catch (err) {
            logger.warn({ err, code: found.rep.promoCode }, "preview checkout: promo code lookup failed; falling back to allow_promotion_codes");
          }
        }

        const customerId = found.lead.email
          ? await resolveCustomerByEmail(stripe, found.lead.email, {
              leadId: leadIdStr,
              repId: String(found.rep.id),
              source: "rep_preview",
            })
          : undefined;

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: lineItems,
          ...(customerId ? { customer: customerId } : { customer_email: found.lead.email ?? undefined }),
          client_reference_id: leadIdStr,
          ...(discounts ? { discounts } : { allow_promotion_codes: allowPromotionCodes }),
          subscription_data: { metadata },
          metadata,
          success_url: successUrl,
          cancel_url: cancelUrl,
          billing_address_collection: "required",
          automatic_tax: {
            enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true",
          },
          ...(customerId
            ? { customer_update: { address: "auto" as const, name: "auto" as const } }
            : {}),
        });
        if (session.url) {
          res.json({ url: session.url, mode: "stripe" as const });
          return;
        }
      } catch (err) {
        logger.error({ err }, "preview checkout: stripe session create failed");
      }
    }

    if (env.stripeProspectPaymentLink) {
      const u = new URL(env.stripeProspectPaymentLink);
      u.searchParams.set("client_reference_id", leadIdStr);
      // Carry template attribution through Payment Link metadata so the rep + webhook
      // can attribute the conversion to the chosen direction.
      u.searchParams.set("prefilled_email", found.lead.email ?? "");
      u.searchParams.set("metadata[templateKey]", templateKey);
      u.searchParams.set("metadata[leadId]", leadIdStr);
      u.searchParams.set("metadata[repId]", String(found.rep.id));
      if (found.rep.promoCode) {
        u.searchParams.set("prefilled_promo_code", found.rep.promoCode);
        u.searchParams.set("metadata[repPromoCode]", found.rep.promoCode);
      }
      res.json({ url: u.toString(), mode: "stripe" as const });
      return;
    }

    await notify({
      repId: found.link.repId,
      type: "preview.preferred",
      title: `${found.lead.practice} clicked checkout (${templateKey}) — Stripe not configured`,
      body: "Send them an invoice manually.",
      linkUrl: `/dashboard/leads/${found.link.leadId}`,
    });
    res.json({ url: null, mode: "fallback" as const });
  }),
);

export default router;
