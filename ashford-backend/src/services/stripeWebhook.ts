import type Stripe from "stripe";
import {
  db,
  stripeEvents,
  sales,
  subscriptions,
  leads,
  salesReps,
  customDevQuotes,
  emailMessages,
  // 2026-05-21 — `clientOnboardings` table dropped (Sprint 2 streamline).
  type LeadSelfServeMeta,
} from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { TIERS, TierKey, type TierKey as TierKeyType } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { normalizePersonName } from "../lib/normalizeName";
import { env } from "../lib/env";
import { notify, notifyOwner } from "./notifications";
// 2026-05-21 — `createOnboardingForSale` removed (Sprint 2 streamline).
import { provisionTier } from "./tierProvisioning";
import {
  sendWelcomeEmail,
  welcomeEmailIdempotencyKey,
  sendPaymentFailedEmail,
  paymentFailedEmailIdempotencyKey,
} from "./customerEmails";
import { TERMS_OF_SERVICE_VERSION } from "../integrations/stripe";

const CLOSING_BONUS_CENTS = 14900; // $149 closing bonus.
const CUSTOM_DEV_REP_COMMISSION_PCT = 10; // 10% of any custom dev that closes.

/** Default tier when metadata is missing or malformed. */
const DEFAULT_TIER: TierKeyType = "boutique";

/** Parses tierKey metadata defensively. Falls back to DEFAULT_TIER. */
const parseTierKey = (raw: string | undefined | null): TierKeyType => {
  const parsed = TierKey.safeParse(raw ?? "");
  return parsed.success ? parsed.data : DEFAULT_TIER;
};

// Resolve the first name of the rep who owns a sale, used to sign the
// post-checkout customer emails ("— Sarah · Ashford Creative, Austin").
// Returns null if there is no rep, the rep was deleted, or displayName
// is empty. Best-effort: never blocks email send.
const lookupRepFirstName = async (
  repId: number | null | undefined,
): Promise<string | null> => {
  if (!repId) return null;
  try {
    const [rep] = await db
      .select({ displayName: salesReps.displayName })
      .from(salesReps)
      .where(eq(salesReps.id, repId))
      .limit(1);
    const first = rep?.displayName?.trim().split(/\s+/)[0];
    return first && first.length > 0 ? first : null;
  } catch (err) {
    logger.warn({ err, repId }, "lookupRepFirstName failed (non-fatal)");
    return null;
  }
};

export const handleStripeEvent = async (event: Stripe.Event) => {
  // Idempotency: try to insert the event row. If a row already exists AND it
  // was successfully processed (processedAt is set), skip. Otherwise allow
  // re-processing — a transient failure on a previous attempt should not
  // strand the event forever. Business-level handlers (e.g. onCheckoutCompleted)
  // also guard against duplicate side-effects via stripeSessionId lookup.
  const inserted = await db
    .insert(stripeEvents)
    .values({
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) {
    const [existing] = await db
      .select({ processedAt: stripeEvents.processedAt })
      .from(stripeEvents)
      .where(eq(stripeEvents.stripeEventId, event.id))
      .limit(1);
    if (existing?.processedAt) {
      logger.info(
        { eventId: event.id },
        "stripe event already processed, skipping",
      );
      return { processed: false };
    }
    logger.info(
      { eventId: event.id },
      "stripe event seen but not yet processed — retrying",
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      // A custom-dev payment link will carry quoteId in metadata.
      if (session.metadata?.quote_id || session.metadata?.quoteId) {
        await onCustomDevQuotePaid(session);
      } else {
        await onCheckoutCompleted(session);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created":
      await onSubscriptionUpsert(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await onSubscriptionCanceled(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await onInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await onInvoiceFailed(event.data.object as Stripe.Invoice);
      break;
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Portal "reserve" payments are bare PaymentIntents (not Checkout
      // Sessions). They carry kind=portal_reserve in metadata so we can
      // route them to the dedicated handler for waitlist signal capture.
      if (pi.metadata?.kind === "portal_reserve") {
        await onPortalReservePaid(pi);
      }
      break;
    }
    default:
      logger.info({ eventType: event.type }, "stripe event received (no handler)");
  }

  await db
    .update(stripeEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeEvents.stripeEventId, event.id));
  return { processed: true };
};

// Find the rep by promo code OR the lead by email/phone (best-effort attribution).
const attributeSession = async (
  s: Stripe.Checkout.Session,
): Promise<{ repId: number | null; leadId: number | null }> => {
  // 1) Explicit metadata IDs win.
  let repId = s.metadata?.repId ? Number(s.metadata.repId) : null;
  let leadId = s.metadata?.leadId ? Number(s.metadata.leadId) : null;

  // 2) Promo code on metadata or stripe-managed promotion code.
  const promoCode =
    s.metadata?.promoCode ||
    (typeof s.total_details?.breakdown?.discounts?.[0]?.discount?.promotion_code ===
    "string"
      ? s.total_details.breakdown.discounts[0].discount.promotion_code
      : null);
  if (!repId && promoCode) {
    const [rep] = await db
      .select({ id: salesReps.id })
      .from(salesReps)
      .where(eq(salesReps.promoCode, promoCode.toUpperCase()))
      .limit(1);
    if (rep) repId = rep.id;
  }

  // 3) Lead lookup by email or phone from the customer details.
  if (!leadId) {
    const email = s.customer_details?.email?.toLowerCase() ?? null;
    const phone = s.customer_details?.phone ?? null;
    if (email || phone) {
      const [lead] = await db
        .select({ id: leads.id, claimedByRepId: leads.claimedByRepId })
        .from(leads)
        .where(
          or(
            email ? sql`lower(${leads.email}) = ${email}` : sql`false`,
            phone ? eq(leads.phone, phone) : sql`false`,
          ),
        )
        .limit(1);
      if (lead) {
        leadId = lead.id;
        if (!repId && lead.claimedByRepId) repId = lead.claimedByRepId;
      }
    }
  }

  return { repId, leadId };
};

/**
 * Plan A self-serve template flow doesn't pre-create a lead row (the
 * prospect is anonymous until they paid), so on `checkout.session.completed`
 * we synthesize one from Stripe's `customer_details` + the metadata the
 * `selfServeReserve` route stamped on the session. This guarantees:
 *   - The rep dashboard shows the new customer (with their template,
 *     palette, addons, chosen domain) the same way claimed leads appear.
 *   - The sale row carries a `leadId` so revenue attribution + LTV
 *     analytics work uniformly.
 *
 * Idempotent via email lookup: a webhook retry finds the existing row and
 * just refreshes its `selfServeMeta` + `lastActivityAt`. When email is
 * missing we fall back to phone; if BOTH are missing we bail (returning
 * null) and the sale row is inserted with leadId=null — better than
 * polluting the leads table with anonymous "—" rows that reps can't action.
 */
const ensureSelfServeLeadFromCheckout = async (
  s: Stripe.Checkout.Session,
): Promise<number | null> => {
  const cd = s.customer_details;
  const email = cd?.email?.toLowerCase().trim() ?? null;
  const phoneRaw = cd?.phone?.trim() ?? null;
  // Both missing → can't action. Skip rather than insert a phantom row.
  if (!email && !phoneRaw) {
    logger.warn(
      { sessionId: s.id },
      "self_serve_template checkout has no email/phone — skipping lead synthesis",
    );
    return null;
  }

  // Look up existing lead first (email preferred, phone fallback).
  let existing: { id: number } | undefined;
  if (email) {
    [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(sql`lower(${leads.email}) = ${email}`)
      .limit(1);
  }
  if (!existing && phoneRaw) {
    [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.phone, phoneRaw.slice(0, 32)))
      .limit(1);
  }

  // Build the metadata blob that the rep dashboard surfaces in the
  // "self-serve order" card (template + palette + addons + domain).
  const meta: LeadSelfServeMeta = {
    templateKey: s.metadata?.templateKey || undefined,
    paletteKey: s.metadata?.paletteKey || undefined,
    addons: s.metadata?.addonKeys
      ? s.metadata.addonKeys
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : undefined,
    chosenDomain: s.metadata?.chosenDomain || undefined,
    funnelSessionId: s.metadata?.funnelSessionId || undefined,
  };
  const localeMeta = (s.metadata?.locale ?? "en").toLowerCase().slice(0, 5);
  const locale = localeMeta === "es" ? "es" : "en";
  const stateRaw = (cd?.address?.state ?? "TX").toUpperCase().slice(0, 2);
  const cityRaw = cd?.address?.city?.trim() || "—";
  const practiceName =
    s.metadata?.practiceName?.trim() ||
    cd?.name?.trim() ||
    "Self-serve customer";
  const personName = cd?.name?.trim() || practiceName;
  const phone = (phoneRaw ?? "").slice(0, 32);

  if (existing) {
    // Refresh the metadata so a returning customer who tweaked their
    // template + repurchased keeps the latest order info on file.
    await db
      .update(leads)
      .set({
        source: "self_serve_template",
        selfServeMeta: meta,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(leads)
    .values({
      // Self-serve checkout — Stripe Customer name can be a copy-paste
      // mess. Normalize before persisting so the rep dashboard never has
      // to clean it on display. See lib/normalizeName.ts.
      name: normalizePersonName(personName).slice(0, 128),
      practice: practiceName.slice(0, 192),
      // No real specialty until the rep enriches; sentinel keeps NOT NULL
      // happy without lying about a clinical area.
      specialty: "self_serve",
      city: cityRaw.slice(0, 64),
      state: stateRaw,
      phone,
      email: email ?? undefined,
      locale,
      // Self-serve leads land already-won — they paid before we even saw
      // them. The status filter on the rep dashboard ("won" view) surfaces
      // them so the rep can shepherd onboarding without claiming.
      status: "won",
      source: "self_serve_template",
      selfServeMeta: meta,
      lastActivityAt: new Date(),
    })
    .returning({ id: leads.id });
  logger.info(
    { sessionId: s.id, leadId: inserted.id, source: "self_serve_template" },
    "synthesized lead from self-serve checkout",
  );
  return inserted.id;
};

const onCheckoutCompleted = async (s: Stripe.Checkout.Session) => {
  const tierKey = parseTierKey(s.metadata?.tierKey);
  const source = s.metadata?.source ?? null;
  // Both `self_serve` (legacy) and `self_serve_template` (Plan A public
  // flow) are house-attributed (no rep bonus). The template flow also
  // synthesizes a lead row on the fly when no pre-existing match is found.
  const isSelfServe =
    source === "self_serve" || source === "self_serve_template";
  const attribution = await attributeSession(s);
  // Self-serve sales never pay a rep closing bonus or first-month add-on
  // bonus, even if the customer's email matches a lead a rep had previously
  // claimed. Treat them as house-attributed by stripping repId.
  const repId = isSelfServe ? null : attribution.repId;
  let leadId = attribution.leadId;
  if (source === "self_serve_template") {
    // Always run for self-serve-template: synthesizes a lead when none
    // exists, OR refreshes `selfServeMeta` (incl. funnelSessionId) on a
    // pre-existing matched lead. Without this branch, returning customers
    // matched by email never get their funnel session stitched onto the
    // lead row — breaking funnel→won attribution in the admin report.
    leadId = await ensureSelfServeLeadFromCheckout(s);
  }
  const promoCode = s.metadata?.promoCode || null;

  // Business-level idempotency: if we already created a sale for this Stripe
  // session (e.g. a previous webhook attempt inserted the sale but crashed
  // before creating onboarding or sending the welcome email), reuse it and
  // continue the flow so this retry can converge to a complete state.
  const [existingSale] = await db
    .select()
    .from(sales)
    .where(eq(sales.stripeSessionId, s.id))
    .limit(1);

  let sale: typeof sales.$inferSelect;
  if (existingSale) {
    logger.info(
      { sessionId: s.id, saleId: existingSale.id },
      "sale already exists for session — continuing to ensure onboarding + welcome email",
    );
    sale = existingSale;
  } else {
    // Source-of-truth pricing: read setup + monthly from TIERS catalog so
    // this never drifts from the public-facing pricing page.
    const setupCents = TIERS[tierKey].setupCents;
    const tierMonthlyCents = TIERS[tierKey].monthlyCents;
    const monthlyCents = (s.amount_subtotal ?? tierMonthlyCents) - setupCents;

    // Stripe-enforced Terms acceptance: consent_collection emits
    // session.consent.terms_of_service = "accepted" when the customer ticks
    // the required checkbox. We mirror that into our own sales row so we own
    // the proof independently of Stripe — version + timestamp + (when
    // available) the originating IP captured at the API edge.
    const tosAccepted = s.consent?.terms_of_service === "accepted";
    const acceptedTermsIp = (s.metadata?.acceptedTermsIp || "").slice(0, 64);

    const [inserted] = await db
      .insert(sales)
      .values({
        repId,
        leadId,
        stripeSessionId: s.id,
        stripeCustomerId: typeof s.customer === "string" ? s.customer : null,
        planKey: tierKey,
        setupAmountCents: setupCents,
        monthlyAmountCents: monthlyCents > 0 ? monthlyCents : tierMonthlyCents,
        closingBonusCents: CLOSING_BONUS_CENTS,
        promoCode,
        acceptedTermsVersion: tosAccepted ? TERMS_OF_SERVICE_VERSION : null,
        acceptedTermsAt: tosAccepted ? new Date() : null,
        acceptedTermsIp: tosAccepted && acceptedTermsIp ? acceptedTermsIp : null,
      })
      .returning();
    sale = inserted;
  }

  if (leadId) {
    await db
      .update(leads)
      .set({ status: "won", lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, leadId));
  }

  // Spec contract: checkout.session.completed must create the subscription
  // attribution row immediately. We upsert by stripeSubscriptionId so a
  // later customer.subscription.created webhook is still idempotent.
  const subId =
    typeof s.subscription === "string"
      ? s.subscription
      : s.subscription?.id ?? null;
  if (subId) {
    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(subscriptions).values({
        saleId: sale.id,
        stripeSubscriptionId: subId,
        status: "active",
        monthlyTotalCents: sale.monthlyAmountCents,
      });
    }
  }

  // 2026-05-21 — Sprint 2 streamline: no more client onboarding record.
  // The site is built from sales-call notes. The welcome email confirms
  // the purchase and sets the "rep contacts you in 24h" expectation.
  const customerEmail =
    s.customer_details?.email ??
    (typeof s.customer_email === "string" ? s.customer_email : null);
  if (customerEmail) {
    const localeMeta = (s.metadata?.locale ?? "").toLowerCase();
    const locale: "en" | "es" = localeMeta === "es" ? "es" : "en";
    const managePortalUrl = `${env.publicBaseUrl}/billing`;

    const [alreadySent] = await db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(eq(emailMessages.inReplyToId, welcomeEmailIdempotencyKey(sale.id)))
      .limit(1);

    if (alreadySent) {
      logger.info(
        { saleId: sale.id, to: customerEmail, emailMessageId: alreadySent.id },
        "welcome email already recorded for this recipient — skipping",
      );
    } else {
      const repFirstName = await lookupRepFirstName(sale.repId);
      try {
        await sendWelcomeEmail({
          to: customerEmail,
          customerName: s.customer_details?.name ?? null,
          tierKey,
          monthlyTotalCents: sale.monthlyAmountCents,
          managePortalUrl,
          locale,
          saleId: sale.id,
          leadId,
          repFirstName,
        });
      } catch (err) {
        // Non-fatal: never let an email failure block webhook processing.
        // The next retry will find no welcome row and try again.
        logger.error(
          { err, saleId: sale.id },
          "welcome email send failed (non-fatal)",
        );
      }
    }
  } else {
    logger.warn(
      { saleId: sale.id },
      "no customer email on checkout session — skipping welcome email",
    );
  }

  const tierLabel = TIERS[tierKey].label;
  if (repId) {
    // Tier upsell bonus = revenue above Boutique base. Pro/Concierge sales
    // pay the rep extra on the first month.
    const tierBonusCents = Math.max(
      0,
      sale.monthlyAmountCents - TIERS.boutique.monthlyCents,
    );
    const totalBonusCents = CLOSING_BONUS_CENTS + tierBonusCents;
    const upsellLine =
      tierBonusCents > 0
        ? ` + $${(tierBonusCents / 100).toFixed(0)} first-month tier upsell bonus`
        : "";
    await notify({
      repId,
      type: "sale.won",
      title: `Sale closed — ${tierLabel}`,
      body: `+$${(CLOSING_BONUS_CENTS / 100).toFixed(0)} closing bonus${upsellLine}. Lead #${leadId ?? "—"}.`,
      payload: {
        saleId: sale.id,
        leadId,
        tierKey,
        closingBonusCents: CLOSING_BONUS_CENTS,
        tierBonusCents,
        totalBonusCents,
      },
      linkUrl: `/dashboard/sales/${sale.id}`,
    });
  }

  await notifyOwner({
    type: "sale.won",
    title: `Sale closed — ${tierLabel}`,
    body: `Sale #${sale.id} on ${tierLabel} ($${sale.monthlyAmountCents / 100}/mo + $${sale.setupAmountCents / 100} setup). Lead #${leadId ?? "—"}, rep #${repId ?? "self_serve"}.`,
    linkUrl: `/ashford-admin/subscriptions`,
  });

  logger.info(
    { saleId: sale.id, tierKey, onboardingToken: onb.token, leadId, repId },
    "checkout completed, sale + onboarding created",
  );
};

const onSubscriptionUpsert = async (s: Stripe.Subscription) => {
  const leadId = s.metadata?.leadId ? Number(s.metadata.leadId) : null;
  if (!leadId) return;
  const [sale] = await db
    .select()
    .from(sales)
    .where(eq(sales.leadId, leadId))
    .limit(1);
  if (!sale) return;
  await db
    .insert(subscriptions)
    .values({
      saleId: sale.id,
      stripeSubscriptionId: s.id,
      status: (s.status as
        | "active"
        | "past_due"
        | "canceled"
        | "trialing"
        | "unpaid"
        | "incomplete") ?? "active",
      monthlyTotalCents: sale.monthlyAmountCents,
      currentPeriodEnd: s.current_period_end
        ? new Date(s.current_period_end * 1000)
        : null,
    })
    .onConflictDoNothing();
  // LOT 3.5 — fire per-tier provisioning hooks (currently no-op stubs)
  // so the integration seam is in place for the first paid Pro/Concierge
  // sale. Soft-fail: never block a webhook on a provisioning error.
  try {
    const planKey = (sale.planKey ?? "boutique") as TierKeyType;
    await provisionTier(planKey, sale.id);
  } catch (err) {
    logger.error({ err, saleId: sale.id }, "tier provisioning failed (non-fatal)");
  }
};

const onSubscriptionCanceled = async (s: Stripe.Subscription) => {
  await db
    .update(subscriptions)
    .set({ status: "canceled", canceledAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, s.id));
};

const onInvoicePaid = async (inv: Stripe.Invoice) => {
  const subId =
    typeof inv.subscription === "string"
      ? inv.subscription
      : inv.subscription?.id ?? null;
  if (!subId) return;
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId))
    .limit(1);
  if (!sub) return;

  // Advance the period.
  const periodEnd =
    inv.lines.data[0]?.period?.end ?? Math.floor(Date.now() / 1000) + 30 * 86400;
  await db
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodEnd: new Date(periodEnd * 1000),
    })
    .where(eq(subscriptions.id, sub.id));

  // No recurring residual — rep comp is closing bonus + first-month add-on bonus only.
};

const onInvoiceFailed = async (inv: Stripe.Invoice) => {
  const subId =
    typeof inv.subscription === "string"
      ? inv.subscription
      : inv.subscription?.id ?? null;
  if (!subId) {
    logger.warn({ invoiceId: inv.id }, "invoice payment failed (no subscription)");
    return;
  }
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId))
    .limit(1);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({ status: "past_due" })
    .where(eq(subscriptions.id, sub.id));

  const [sale] = await db
    .select({
      repId: sales.repId,
      leadId: sales.leadId,
      stripeCustomerId: sales.stripeCustomerId,
      planKey: sales.planKey,
    })
    .from(sales)
    .where(eq(sales.id, sub.saleId))
    .limit(1);
  if (sale?.repId) {
    await notify({
      repId: sale.repId,
      type: "subscription.past_due",
      title: "Payment failed — dunning",
      body: `An invoice on one of your subscriptions just failed. Stripe will retry — please reach out to the client.`,
      payload: { saleId: sub.saleId, invoiceId: inv.id },
      linkUrl: `/dashboard/sales/${sub.saleId}`,
    });
  }

  await notifyOwner({
    type: "subscription.past_due",
    title: `Payment failed (Sale #${sub.saleId})`,
    body: `Stripe invoice ${inv.id} on ${sale?.planKey ? TIERS[sale.planKey as TierKeyType]?.label ?? sale.planKey : "?"} failed. Stripe will retry per your dunning settings.`,
    linkUrl: `/ashford-admin/subscriptions`,
  });

  // Customer-facing dunning email — polite bilingual notice with a link back
  // to the onboarding page (which exposes the Manage-billing portal). Idempotent
  // on the invoice ID so Stripe's automatic retries don't double-send.
  const customerEmail =
    typeof inv.customer_email === "string" && inv.customer_email
      ? inv.customer_email
      : null;
  if (customerEmail && sale) {
    const idempotencyKey = paymentFailedEmailIdempotencyKey(inv.id ?? "unknown");
    const [already] = await db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(eq(emailMessages.inReplyToId, idempotencyKey))
      .limit(1);
    if (already) {
      logger.info(
        { invoiceId: inv.id, emailMessageId: already.id },
        "payment-failed email already recorded for invoice — skipping",
      );
    } else {
      const localeMeta =
        ((inv.subscription_details?.metadata?.locale ??
          inv.lines.data[0]?.metadata?.locale) || "")
          .toLowerCase();
      const locale: "en" | "es" = localeMeta === "es" ? "es" : "en";
      const nextRetryAt = inv.next_payment_attempt
        ? new Date(inv.next_payment_attempt * 1000)
        : null;
      // 2026-05-21 — Sprint 2 streamline: clientOnboardings table dropped,
      // so no more token-scoped billing portal URL. Fall back to a stable
      // /billing route on the public site.
      const managePortalUrl = `${env.publicBaseUrl}/billing`;
      const repFirstName = await lookupRepFirstName(sale.repId);
      try {
        await sendPaymentFailedEmail({
          to: customerEmail,
          customerName: typeof inv.customer_name === "string" ? inv.customer_name : null,
          amountDueCents: inv.amount_due ?? 0,
          nextRetryAt,
          managePortalUrl,
          invoiceId: inv.id ?? "unknown",
          saleId: sub.saleId,
          leadId: sale.leadId,
          locale,
          repFirstName,
        });
      } catch (err) {
        logger.error(
          { err, invoiceId: inv.id, saleId: sub.saleId },
          "payment-failed email send failed (non-fatal)",
        );
      }
    }
  }
};

/**
 * Portal-reserve PaymentIntent succeeded. The base $199 has been charged
 * but the prospect's add-on selection is captured here as `addon_interest_signals`
 * (waitlist rows) — NOT charged. The rep's job is to convert each signal
 * into a custom-dev quote.
 */
const onPortalReservePaid = async (pi: Stripe.PaymentIntent) => {
  const portalIdRaw = pi.metadata?.portalId;
  const leadIdRaw = pi.metadata?.leadId;
  const slug = pi.metadata?.portalSlug ?? null;
  const tierKey = parseTierKey(pi.metadata?.tierKey);
  const leadId = leadIdRaw ? Number(leadIdRaw) : null;
  const portalId = portalIdRaw ? Number(portalIdRaw) : null;
  const addonSlugs = (pi.metadata?.addonSlugs ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!leadId || !portalId) {
    logger.warn(
      { paymentIntentId: pi.id },
      "portal_reserve PI missing leadId/portalId in metadata",
    );
    return;
  }
  const { captureAddonSignals, markReserved, recordPortalEvent } = await import(
    "./portals"
  );
  await markReserved(portalId);
  if (slug) {
    await recordPortalEvent(slug, {
      eventType: "reserve_succeeded",
      metadata: { paymentIntentId: pi.id, addonSlugs },
    });
  }
  await captureAddonSignals(leadId, portalId, addonSlugs, "reserved_with");

  // Capture lead snapshot BEFORE we flip status — we need email + repId.
  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      practice: leads.practice,
      city: leads.city,
      state: leads.state,
      claimedByRepId: leads.claimedByRepId,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  await db
    .update(leads)
    .set({ status: "won", lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  // Resolve add-on names so the welcome email + notifications can show
  // them by their human label rather than internal slugs.
  const { getAddonCatalog } = await import("./portals");
  const catalog = await getAddonCatalog();
  const addonNames = addonSlugs
    .map((s) => catalog.find((a) => a.slug === s)?.name)
    .filter((n): n is string => !!n);

  // Welcome email — addresses the prospect, mentions the locked add-ons.
  if (lead?.email) {
    try {
      const { sendEmail } = await import("../integrations/resend");
      const firstName = (lead.name ?? "").split(/\s+/)[0] || "there";
      const lockedAddonsLine =
        addonNames.length > 0
          ? `\n\nYour locked add-ons (waitlist):\n${addonNames
              .map((n) => `  • ${n}`)
              .join("\n")}\n\nWe'll reach out to launch each one as soon as it's ready — your reserved price is locked in.`
          : "";
      const tierLabel = TIERS[tierKey].label;
      const tierMonthly = `$${TIERS[tierKey].monthlyCents / 100}`;
      await sendEmail({
        to: lead.email,
        subject: "Welcome to Ashford Creative — your build starts now",
        body: `Hi ${firstName},

Thank you for reserving your Ashford Creative website. Your ${tierLabel} subscription (${tierMonthly}/month) is active and we'll start your build within one business day.${lockedAddonsLine}

We'll be in touch shortly with next steps and a kickoff call link.

— The Ashford Creative team`,
        leadId,
        repId: lead.claimedByRepId ?? undefined,
      });
    } catch (err) {
      logger.warn(
        { err, leadId, paymentIntentId: pi.id },
        "portal_reserve welcome email failed (non-fatal)",
      );
    }
  }

  // Notify the assigned rep (in addition to the owner) so they can call
  // the prospect immediately while the moment is hot.
  const tierLabelForNotify = TIERS[tierKey].label;
  const tierMonthlyForNotify = `$${TIERS[tierKey].monthlyCents / 100}`;
  if (lead?.claimedByRepId) {
    await notify({
      repId: lead.claimedByRepId,
      type: "sale.won",
      title: `${lead.name ?? "Prospect"} reserved their portal`,
      body: `${lead.practice ?? "Practice"} (${lead.city ?? ""}). ${tierLabelForNotify} (${tierMonthlyForNotify}/mo) charged. Add-on waitlist: ${
        addonNames.length > 0 ? addonNames.join(", ") : "none"
      }. Call them today.`,
      linkUrl: `/leads/${leadId}`,
    });
  }

  await notifyOwner({
    type: "sale.won",
    title: `Portal reserve paid (lead #${leadId})`,
    body: `${tierLabelForNotify} (${tierMonthlyForNotify}/mo) subscription via portal ${slug ?? portalId}. Add-on waitlist: ${
      addonNames.length > 0 ? addonNames.join(", ") : "none"
    }.`,
    linkUrl: `/ashford-admin/subscriptions`,
  });
};

const onCustomDevQuotePaid = async (s: Stripe.Checkout.Session) => {
  const rawQuoteId = s.metadata?.quote_id ?? s.metadata?.quoteId;
  const quoteId = rawQuoteId ? Number(rawQuoteId) : null;
  if (!quoteId) return;
  const [updated] = await db
    .update(customDevQuotes)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(customDevQuotes.id, quoteId))
    .returning();
  if (!updated) return;
  // Credit 10% to the rep.
  if (updated.repId && updated.quotedAmountCents) {
    const commissionCents = Math.round(
      (updated.quotedAmountCents * CUSTOM_DEV_REP_COMMISSION_PCT) / 100,
    );
    await notify({
      repId: updated.repId,
      type: "custom_dev.commission",
      title: "Custom dev paid — commission credited",
      body: `+$${(commissionCents / 100).toFixed(2)} (${CUSTOM_DEV_REP_COMMISSION_PCT}% of $${(updated.quotedAmountCents / 100).toFixed(2)}).`,
      payload: {
        quoteId,
        commissionCents,
        gross: updated.quotedAmountCents,
      },
      linkUrl: `/dashboard/custom-dev`,
    });
  }
};

// For dev mode (no real stripe) — synthesize a checkout-completed event.
export const synthesizeDevCheckout = async (params: {
  tierKey: TierKeyType;
  leadId?: number;
  repId?: number;
  promoCode?: string;
  monthlyTotalCents: number;
}) => {
  const fakeSession = {
    id: `cs_dev_${Date.now()}`,
    object: "checkout.session",
    amount_subtotal:
      params.monthlyTotalCents + TIERS[params.tierKey].setupCents,
    customer: null,
    customer_details: { email: null, phone: null },
    metadata: {
      tierKey: params.tierKey,
      leadId: params.leadId ? String(params.leadId) : "",
      repId: params.repId ? String(params.repId) : "",
      promoCode: params.promoCode ?? "",
    },
  } as unknown as Stripe.Checkout.Session;
  const fakeEvent = {
    id: `evt_dev_${Date.now()}`,
    type: "checkout.session.completed",
    data: { object: fakeSession },
  } as unknown as Stripe.Event;
  return handleStripeEvent(fakeEvent);
};

// Synthesize a custom-dev quote payment webhook for dev mode.
export const synthesizeDevQuotePayment = async (quoteId: number) => {
  const fakeSession = {
    id: `cs_dev_q${quoteId}_${Date.now()}`,
    object: "checkout.session",
    metadata: { quoteId: String(quoteId) },
  } as unknown as Stripe.Checkout.Session;
  const fakeEvent = {
    id: `evt_dev_q${quoteId}_${Date.now()}`,
    type: "checkout.session.completed",
    data: { object: fakeSession },
  } as unknown as Stripe.Event;
  return handleStripeEvent(fakeEvent);
};
