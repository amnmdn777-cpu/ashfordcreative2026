import { Router, type IRouter } from "express";
import { z } from "zod";
import type Stripe from "stripe";
import {
  PortalEventRequest,
  PortalCartRequest,
  PortalReserveRequest,
  PortalPatchCustomizationsRequest,
  type PortalReserveResponse,
  TIERS,
  type TierKey,
} from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { rateLimit } from "../../middleware/rateLimit";
import { notFound, badRequest } from "../../lib/errors";
import {
  buildPortalPublicResponse,
  recordPortalOpen,
  patchPortalCustomizations,
  recordPortalEvent,
  saveCart,
  getAddonCatalog,
  getPortalPhotoReference,
  requirePortalAccess,
  getPortalBySlug,
  verifyOgSignature,
  computeOgSignature,
} from "../../services/portals";
import { stripe } from "../../integrations/stripe";
import { streamAudioObject } from "../../integrations/audioStorage";
import { logger } from "../../lib/logger";
import { env } from "../../lib/env";
import { db, leads } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  mintProspectSession,
  validateProspectSession,
} from "../../services/prospectSessions";
import { resolvePortalRepActor } from "../../services/portalAuth";
import { unauthorized } from "../../lib/errors";

const router: IRouter = Router();

const SlugParam = z
  .string()
  .min(2)
  .max(96)
  .regex(/^[a-z0-9-]+$/i);

/**
 * Pulls the portal access token from either the `t` query param (used on
 * first navigation from the invite link) or the `X-Portal-Token` header
 * (used by the SPA on subsequent calls so the token doesn't have to live
 * in the URL bar).
 */
const extractToken = (req: {
  query: Record<string, unknown>;
  header: (n: string) => string | undefined;
}): string | undefined => {
  const headerVal = req.header("x-portal-token");
  if (headerVal) return headerVal;
  const q = req.query.t;
  if (typeof q === "string") return q;
  return undefined;
};

router.get(
  "/public/portals/:slug",
  // LOT 1.5 — route-level rate-limit on the GET path. The merged-
  // doc's slug-disclosure fix is paired with this bucket because
  // uniformizing the response only matters if an attacker can't
  // spray. 30/min/IP: an honest prospect fires ONE GET on portal
  // load (the SPA shifts to events/cart/customizations after,
  // which have their own buckets), so 30/min is generous even on a
  // NAT'd coffee-shop IP, while capping enum at 1800/hour/IP — meaningful
  // friction against a 100k+ slug space. The rate-limit runs BEFORE
  // requirePortalAccess so a 429 never burns a portal.access.denied
  // audit row (the audit table tracks denied attempts, not throttled
  // ones).
  rateLimit({ name: "portal_get", capacity: 30, refillPerSecond: 30 / 60 }),
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    // Pass `req` so an authenticated rep (owner or admin) viewing an
    // expired portal for archival / post-mortem still gets 200 instead
    // of 410. Prospect path stays gated.
    const portal = await requirePortalAccess(slug, extractToken(req), req);
    // LOT 1.3 — bootstrap or re-validate the prospect-session cookie
    // on the first GET. Subsequent cart writes are gated on this
    // cookie so a leaked token alone can't tamper. We re-mint on a
    // miss (no_cookie | unknown_token | wrong_portal) because the
    // GET path is already gated by `requirePortalAccess` — the token
    // is the proof of legitimate access here; the cookie binds that
    // proof to a browser session.
    //
    // Deploy-config note: the SPA fetches with default `same-origin`
    // credentials and the API rides the same Express app at /api, so
    // Set-Cookie carries normally. A future deploy that splits the
    // API to a separate origin must set `credentials: "include"` on
    // the SPA fetch and `Access-Control-Allow-Credentials: true` on
    // the CORS allow-list, otherwise this cookie path silently breaks.
    const sessionCheck = await validateProspectSession(req, portal.id, slug);
    let openSessionId: string | null = null;
    if (sessionCheck.ok) {
      openSessionId = sessionCheck.session.tokenHash;
    } else {
      const minted = await mintProspectSession(req, res, portal.id, slug);
      openSessionId = minted.tokenHash;
    }
    // 2026-05-14 audit fix #4: skip open-tracking when the request comes
    // from the rep dashboard. Three signals — owning-rep session cookie,
    // ?internal=1 query, or X-Ashford-Internal:rep header — keep the
    // prospect open-count clean of the rep's own preview loads.
    const isInternalQuery = req.query.internal === "1";
    const isInternalHeader = req.get("x-ashford-internal") === "rep";
    const repActor = await resolvePortalRepActor(req, portal.leadId).catch(
      () => null,
    );
    const isRepPreview = !!repActor || isInternalQuery || isInternalHeader;
    if (isRepPreview) {
      logger.info(
        { slug, leadId: portal.leadId, repId: repActor?.repId ?? null },
        "repPreviewOpen — skipping recordPortalOpen",
      );
    } else {
      // Fire & forget — open tracking shouldn't slow the page render.
      void recordPortalOpen(portal.id, openSessionId).catch((err) =>
        logger.warn({ err, slug }, "recordPortalOpen failed"),
      );
    }
    const payload = await buildPortalPublicResponse(portal);
    res.json(payload);
  }),
);

// ASH-8: serve the rep-uploaded hero image from object storage through a
// stable, public URL. The portal's customizations hold the object key; we
// stream the bytes so the storage bucket itself need not be public. Used by
// both the rep preview and the client-facing portal (and the emailed copy).
router.get(
  "/public/portals/:slug/hero-image",
  rateLimit({ name: "portal_hero_image", capacity: 60, refillPerSecond: 60 / 60 }),
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    const portal = await getPortalBySlug(slug);
    const key = (
      portal?.customizations as { heroImageKey?: string } | null | undefined
    )?.heroImageKey;
    if (!portal || !key) {
      res.status(404).end();
      return;
    }
    const obj = await streamAudioObject(key);
    if (!obj) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(obj.buffer);
  }),
);

router.patch(
  "/public/portals/:slug/customizations",
  rateLimit({ name: "portal_customize", capacity: 60, refillPerSecond: 2 }),
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    // Rep-bypass via `req`: an owning rep editing the preview after
    // expire (rare but legitimate — they may want to scrub a piece
    // of copy before archival) gets through.
    await requirePortalAccess(slug, extractToken(req), req);
    const body = PortalPatchCustomizationsRequest.parse(req.body);
    if (!body.selectedTemplate && !body.customizations) {
      throw badRequest("Nothing to update.");
    }
    await patchPortalCustomizations(slug, body);
    res.json({ ok: true });
  }),
);

router.post(
  "/public/portals/:slug/events",
  rateLimit({ name: "portal_event", capacity: 120, refillPerSecond: 4 }),
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    // Rep-bypass via `req`: rep replaying or QA-ing an event flow
    // after expire still goes through; prospect path stays gated.
    await requirePortalAccess(slug, extractToken(req), req);
    const body = PortalEventRequest.parse(req.body);
    await recordPortalEvent(slug, body);
    res.json({ ok: true });
  }),
);

/**
 * LOT 1.3 — Resolves the actor authorized to write the cart for this
 * portal. Three branches in priority order:
 *
 *   1. Valid rep session cookie AND (rep owns the lead OR is admin):
 *      `kind: "rep"`. Writes are tagged source='rep' so they're
 *      invisible to the prospect-facing payload and to the rep-side
 *      "what the prospect sees" view.
 *
 *   2. Valid prospect-session cookie matching the portal:
 *      `kind: "prospect"`. Writes are tagged source='prospect'.
 *
 *   3. Neither: 401 with a structured reason so the SPA can decide
 *      whether to retry (re-mint cookie via GET) or surface an error.
 *
 * Returns a discriminated union so the caller can pick the right
 * rate-limit bucket key and source tag.
 */
type CartActor =
  | { kind: "rep"; repId: number; rateKey: string }
  | { kind: "prospect"; sessionId: number; rateKey: string }
  | { kind: "deny"; reason: string };

const resolveCartActor = async (
  req: import("express").Request,
  portalId: number,
  leadId: number,
  slug: string,
): Promise<CartActor> => {
  // (1) Rep-bypass path. Auth + ownership/admin check delegated to
  // resolvePortalRepActor so this branch and the lifecycle bypass in
  // requirePortalAccess can never diverge. Unclaimed-lead posture is
  // identical to LOT 1.1: no bypass without ownership or admin.
  const rep = await resolvePortalRepActor(req, leadId);
  if (rep) {
    return { kind: "rep", repId: rep.repId, rateKey: `rep:${rep.repId}` };
  }
  // (2) Prospect-session path.
  const check = await validateProspectSession(req, portalId, slug);
  if (check.ok) {
    // Rate-limit key derived from the cookie hash, never the cookie
    // value itself — keeps the key out of in-memory log lines while
    // still being stable per session.
    const rateKey = `prospect:${createHash("sha256")
      .update(check.session.tokenHash)
      .digest("hex")
      .slice(0, 16)}`;
    return { kind: "prospect", sessionId: check.session.id, rateKey };
  }
  return { kind: "deny", reason: check.reason };
};

router.post(
  "/public/portals/:slug/cart",
  // LOT 1.3 — bucket keyed on the actor (rep id or hashed prospect
  // cookie), not on IP, so coffee-shop NAT'd prospects don't poison
  // each other's bucket. The legacy global IP limiter is gone — the
  // new keyFn covers both honest reps and honest prospects, and the
  // deny branch below short-circuits before we reach saveCart so an
  // anonymous flood can't burn cart_update rows.
  asyncHandler(async (req, res, next) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    // Pass `req` so rep-bypass survives the lifecycle gate consistently
    // with GET /:slug. resolveCartActor will re-derive the rep actor
    // for the cart-specific source tagging.
    const portal = await requirePortalAccess(slug, extractToken(req), req);
    const actor = await resolveCartActor(req, portal.id, portal.leadId, slug);
    if (actor.kind === "deny") {
      throw unauthorized(
        "Cart writes require a prospect session cookie or an authenticated rep.",
      );
    }
    // Apply the per-actor rate-limit only after we know who's writing,
    // so the bucket key is the actor (cookie hash or rep id), not the
    // request IP. Capacity 10 / refill 10 per 60s matches the
    // merged-doc spec.
    rateLimit({
      name: "portal_cart",
      capacity: 10,
      refillPerSecond: 10 / 60,
      keyFn: () => actor.rateKey,
    })(req, res, (err) => {
      if (err) return next(err);
      // Body parsed inside the rate-limit callback so a rate-limited
      // request doesn't pay the zod cost.
      Promise.resolve()
        .then(async () => {
          const body = PortalCartRequest.parse(req.body);
          const totals = await saveCart(slug, body, {
            source: actor.kind === "rep" ? "rep" : "prospect",
          });
          res.json({ ok: true, ...totals });
        })
        .catch(next);
    });
  }),
);

/**
 * Reserve = $199/mo recurring Stripe Subscription. We create a Customer +
 * Subscription with `payment_behavior: "default_incomplete"`; the first
 * invoice's PaymentIntent client_secret powers the embedded Payment Element.
 * When that PI succeeds the webhook (kind=portal_reserve) marks the portal
 * reserved, captures add-on waitlist signals, and notifies rep+admin.
 *
 * Add-ons are NOT charged here — they're "raised hand" signals captured as
 * rows in `addon_interest_signals` at webhook time.
 *
 * Fallback semantics (important):
 *   - When Stripe is NOT configured (no key), we return mode:"fallback"
 *     WITHOUT marking the portal reserved or firing reserve_succeeded —
 *     the frontend renders an explicit "online payment unavailable" card.
 *   - When Stripe IS configured but the create call fails, we return
 *     HTTP 502 so the prospect sees a real error and we don't silently
 *     mark them reserved without payment.
 */
router.post(
  "/public/portals/:slug/reserve",
  rateLimit({ name: "portal_reserve", capacity: 6, refillPerSecond: 0.2 }),
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    const portal = await requirePortalAccess(slug, extractToken(req));
    const body = PortalReserveRequest.parse(req.body);

    // Always record a "reserve_clicked" event for funnel tracking.
    await recordPortalEvent(slug, {
      eventType: "reserve_clicked",
      templateKey: body.templateKey,
      metadata: { addonSlugs: body.addonSlugs, email: body.customerEmail },
    });

    // Refresh cart so the rep timeline shows the final selection that triggered reserve.
    await saveCart(slug, {
      templateKey: body.templateKey,
      addonSlugs: body.addonSlugs,
    });

    // Validate addon slugs exist in catalog (silently drops unknowns).
    const catalog = await getAddonCatalog();
    const knownSlugs = new Set(catalog.map((a) => a.slug));
    const validAddons = body.addonSlugs.filter((s) => knownSlugs.has(s));

    // Hard-gate the live payment path on BOTH keys: secret (for the
    // server-side subscription create call) AND publishable (for the
    // browser-side Payment Element). With only one configured we'd create
    // an orphaned incomplete subscription in Stripe that the prospect
    // could never pay (no usable publishable key client-side), so fall
    // back to the manual path instead.
    //
    // Inline `stripe && stripePublishable` (vs a hoisted boolean) so TS
    // narrows `stripe` to non-null inside the block — `stripeReady`
    // doesn't carry the narrowing through.
    const stripePublishable = process.env.STRIPE_PUBLISHABLE_KEY ?? null;

    if (stripe && stripePublishable) {
      try {
        const price = await getOrCreateTierMonthlyPrice(body.tierKey);

        // The lead row carries the prospect's name (used as the human
        // fallback when the reserve form's customerName is blank).
        // prospectPortals itself doesn't store name — only leadId.
        const [leadRow] = await db
          .select({ name: leads.name })
          .from(leads)
          .where(eq(leads.id, portal.leadId))
          .limit(1);

        // Always create a fresh customer per reserve to keep this endpoint
        // idempotent without DB lookups; if the prospect retries, Stripe
        // dedupes via email + we don't accidentally re-attach the wrong card.
        const customer = await stripe.customers.create({
          email: body.customerEmail,
          name: body.customerName ?? leadRow?.name ?? undefined,
          metadata: {
            portalSlug: slug,
            portalId: String(portal.id),
            leadId: String(portal.leadId),
          },
        });

        // payment_behavior: default_incomplete creates the subscription in
        // a state where the first invoice's PaymentIntent is unpaid; the
        // Payment Element collects the card and confirms it client-side.
        // expand: latest_invoice.payment_intent surfaces the client_secret.
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: price.id, quantity: 1 }],
          payment_behavior: "default_incomplete",
          payment_settings: {
            save_default_payment_method: "on_subscription",
            payment_method_types: ["card"],
          },
          expand: ["latest_invoice.payment_intent"],
          // STRIPE_AUTOMATIC_TAX_ENABLED gate — see integrations/stripe.ts.
          // Direct subscriptions.create (Payment Element, not Checkout) so
          // tax falls back to customer IP until the Payment Element saves a
          // billing address on the Customer.
          automatic_tax: {
            enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true",
          },
          metadata: {
            kind: "portal_reserve",
            portalSlug: slug,
            portalId: String(portal.id),
            leadId: String(portal.leadId),
            templateKey: body.templateKey,
            tierKey: body.tierKey,
            addonSlugs: validAddons.join(","),
            customerEmail: body.customerEmail,
            customerName: body.customerName ?? "",
            chosenDomain: body.chosenDomain ?? "",
          },
        });

        const invoice = subscription.latest_invoice as Stripe.Invoice | null;
        const pi = invoice?.payment_intent as Stripe.PaymentIntent | null;
        if (!pi || !pi.client_secret) {
          throw new Error(
            "Stripe subscription returned no PaymentIntent client_secret",
          );
        }

        // Stamp the PI with the same metadata so the existing
        // payment_intent.succeeded webhook handler (which keys on
        // metadata.kind === "portal_reserve") fires for the FIRST invoice
        // only. Renewal invoices generate fresh PIs without our metadata,
        // so onPortalReservePaid will not re-fire on monthly renewal.
        await stripe.paymentIntents.update(pi.id, {
          metadata: {
            kind: "portal_reserve",
            portalSlug: slug,
            portalId: String(portal.id),
            leadId: String(portal.leadId),
            templateKey: body.templateKey,
            tierKey: body.tierKey,
            addonSlugs: validAddons.join(","),
            customerEmail: body.customerEmail,
            customerName: body.customerName ?? "",
            chosenDomain: body.chosenDomain ?? "",
            subscriptionId: subscription.id,
          },
        });

        const response: PortalReserveResponse = {
          mode: "payment_intent",
          clientSecret: pi.client_secret,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
        };
        res.json(response);
        return;
      } catch (err) {
        logger.error(
          { err, slug },
          "portal reserve: stripe subscription create failed",
        );
        // 502 — explicitly do NOT markReserved / fire reserve_succeeded.
        res.status(502).json({
          error: {
            code: "payment_provider_unavailable",
            message:
              "We could not start the payment right now. Please try again in a moment.",
          },
        });
        return;
      }
    }

    // No Stripe key configured. Surface this honestly: don't pretend the
    // payment succeeded. Reps testing locally without a key can still see
    // the modal flow in the frontend.
    logger.warn(
      { slug, addons: validAddons },
      "portal reserve: stripe not configured — returning fallback (no reserve)",
    );
    const response: PortalReserveResponse = {
      mode: "fallback",
      clientSecret: null,
      publishableKey: null,
      url: null,
    };
    res.json(response);
  }),
);

/**
 * Resolves the recurring tier monthly Price for the portal reserve flow.
 * Looks up `ashford_tier_<tierKey>_monthly` (synced by stripeCatalogSync.ts).
 * If the lookup misses, creates the Product + Price inline so the reserve
 * flow can fire even before the daily sync has run on a fresh deploy.
 *
 * Per-process cache keyed by tierKey to skip the Stripe round-trip on hot paths.
 */
const tierPriceCache = new Map<TierKey, { id: string }>();
const getOrCreateTierMonthlyPrice = async (
  tierKey: TierKey,
): Promise<{ id: string }> => {
  const cached = tierPriceCache.get(tierKey);
  if (cached) return cached;
  if (!stripe) throw new Error("stripe not configured");
  const tier = TIERS[tierKey];
  const lookupKey = `ashford_tier_${tierKey}_monthly`;
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    const result = { id: existing.data[0].id };
    tierPriceCache.set(tierKey, result);
    return result;
  }
  // No live Price under this lookup_key. Fall through to inline create so a
  // fresh deploy can serve reserve traffic before the daily catalog sync ran.
  const found = await stripe.products.search({
    query: `metadata['ashford_kind']:'tier' AND metadata['ashford_key']:'${tierKey}'`,
    limit: 1,
  });
  let productId = found.data[0]?.id;
  if (!productId) {
    const created = await stripe.products.create({
      name: `Ashford Creative — ${tier.label} (monthly)`,
      description: tier.description,
      metadata: { ashford_kind: "tier", ashford_key: tierKey },
    });
    productId = created.id;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: tier.monthlyCents,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    tax_behavior: "exclusive",
    metadata: { ashford_kind: "tier", ashford_key: tierKey },
  });
  const result = { id: price.id };
  tierPriceCache.set(tierKey, result);
  return result;
};

/**
 * Public OG image. Renders a personalized card containing the prospect's
 * name + practice — therefore gated by the same access token as every other
 * public portal endpoint. The link a prospect shares already carries `?t=`
 * (we generate invite URLs with the token), so messaging-client previewers
 * that follow the share URL will pass it through to the OG meta tag we
 * eventually inline. Without the token we serve the brand placeholder
 * instead of leaking personalized data.
 */
router.get(
  "/public/portals/:slug/og.png",
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    const token = extractToken(req);
    const ogSig = typeof req.query.og === "string" ? req.query.og : undefined;
    const portal = await getPortalBySlug(slug);
    if (!portal) throw notFound("Portal not found.");
    // Auth gate: accept EITHER the full portal access token (logged-in
    // prospect viewing the page) OR the OG-only signature embedded in the
    // <meta og:image> URL. The OG signature lets link-preview crawlers
    // (iMessage, Slack, Discord, Twitter) render the personalized image
    // without exposing the full token. Missing/wrong creds => generic
    // brand placeholder via 302 (not a 4xx — unfurlers should still get
    // an image).
    let authorized = false;
    if (ogSig && verifyOgSignature(slug, ogSig)) {
      authorized = true;
    } else {
      try {
        await requirePortalAccess(slug, token);
        authorized = true;
      } catch {
        authorized = false;
      }
    }
    if (!authorized) {
      // Default placeholder is non-personalized — public cache is fine.
      res.setHeader("Cache-Control", "public, max-age=900");
      res.redirect(302, `${env.publicBaseUrl}/og-default.png`);
      return;
    }
    // Try the dynamic renderer; fall back to a 302 to the public site logo.
    try {
      const { renderPortalOgPng } = await import(
        "../../integrations/ogImage"
      );
      const buf = await renderPortalOgPng(portal.id);
      res.setHeader("Content-Type", "image/png");
      // Personalized image: never share via shared/proxy caches. The token
      // is the access key — only the authorized client should hold the
      // rendered bytes. `private` keeps this off CDN-style caches; the
      // short max-age trims server load for an authorized client that
      // reloads the page.
      res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
      res.end(buf);
    } catch (err) {
      logger.warn({ err, slug }, "og image render failed; redirecting");
      res.redirect(302, `${env.publicBaseUrl}/og-default.png`);
    }
  }),
);

/**
 * Public photo proxy. Resolves `/photos/:idx` to the corresponding
 * Google Places photo for the lead, then 302-redirects to the final
 * `googleusercontent.com` URL after stripping our API key from the response.
 *
 * We never return the raw `maps.googleapis.com/.../photo?...&key=XYZ` URL
 * to the client because that would leak `GOOGLE_PLACES_API_KEY`. Instead we
 * fetch with `redirect: 'manual'`, read the `Location` header (which is
 * already the redirected googleusercontent URL with no key), and 302 to it.
 *
 * No portal access token is required: photo bytes are derived from publicly
 * available Google Places business photos, scoped to the slug. Slug must
 * exist (404 otherwise) and the rate limit prevents abuse.
 */
const PhotoIdxParam = z.coerce.number().int().min(0).max(9);

router.get(
  "/public/portals/:slug/photos/:idx",
  rateLimit({ name: "portal_photo", capacity: 60, refillPerSecond: 4 }),
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    const idx = PhotoIdxParam.parse(req.params.idx);
    const portal = await getPortalBySlug(slug);
    if (!portal) throw notFound("Portal not found.");
    if (!env.googlePlacesApiKey) {
      // No upstream configured. Tell caller to use a fallback image.
      throw notFound("Photo unavailable.");
    }
    const ref = await getPortalPhotoReference(portal.leadId, idx);
    if (!ref) throw notFound("Photo unavailable.");
    const upstream = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${encodeURIComponent(
      ref,
    )}&key=${env.googlePlacesApiKey}`;
    // Hard timeout for the upstream call. Google Places photo redirects in
    // a few hundred ms in steady state; if we don't hear back in 5s
    // something is wrong and we should fail fast rather than tie up the
    // request thread.
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    try {
      // `redirect: 'manual'` makes fetch return the 302 itself instead of
      // following it, so we can capture the Location header (which points
      // at `lh3.googleusercontent.com/...` — no API key in it).
      const upRes = await fetch(upstream, {
        redirect: "manual",
        signal: ac.signal,
      });
      const finalUrl = upRes.headers.get("location");
      if (!finalUrl) {
        // Defensive: Places photo endpoint should always 302. If not, fall
        // back to streaming the body so we don't expose the keyed URL.
        // Cap at 4MB — Places photos are typically <500kB; bigger payloads
        // are a sign of upstream weirdness, not a legitimate hero photo.
        const lenHeader = upRes.headers.get("content-length");
        if (lenHeader && Number(lenHeader) > 4 * 1024 * 1024) {
          throw notFound("Photo too large.");
        }
        const buf = Buffer.from(await upRes.arrayBuffer());
        if (buf.byteLength > 4 * 1024 * 1024) {
          throw notFound("Photo too large.");
        }
        res.setHeader(
          "Content-Type",
          upRes.headers.get("content-type") ?? "image/jpeg",
        );
        // Photo bytes are non-personalized (public Google business photo) but
        // the 1-day cap keeps us responsive to upstream churn.
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.end(buf);
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.redirect(302, finalUrl);
    } catch (err) {
      logger.warn(
        { err, slug, idx },
        "google places photo proxy failed",
      );
      throw notFound("Photo unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }),
);

export default router;
