import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  UpdateLeadRequest,
  AddLeadRepNoteRequest,
  ScheduleCallbackRequest,
  SendSmsRequest,
  SendEmailRequest,
  CreatePreviewLinkRequest,
} from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  requireAuth,
  requireOnboardingComplete,
} from "../../middleware/requireAuth";
import {
  claimLead,
  startWorkOnLead,
  getAvailableLeads,
  getHotLeadsForRep,
  getLeadTimeline,
  getRepCallbacks,
  getRepLeads,
  scheduleCallback,
  updateLeadByRep,
  addLeadRepNote,
  listLeadRepNotes,
  editLeadRepNote,
} from "../../services/leads";
import { dateToIso } from "../../lib/serialize";
import { sendSms } from "../../integrations/dialpad";
import { sendEmail } from "../../integrations/resend";
import {
  db,
  leads as leadsTbl,
  prospectLinks as prospectLinksTbl,
  prospectPortals,
} from "@workspace/db";
import { rateLimit } from "../../middleware/rateLimit";
import { writeAudit } from "../../services/auditLog";
import { eq } from "drizzle-orm";
import { badRequest, notFound } from "../../lib/errors";
import {
  createPreviewLink,
  getLatestLinkForLead,
  recordLinkEvent,
} from "../../services/prospectLinks";
import {
  renderPortalInviteDraft,
  sendPortalInvite,
} from "../../services/portalInvite";
import { ensurePortalForLead, patchPortalCustomizations } from "../../services/portals";
import {
  buildPortalScreenshotUrl,
  warmPortalScreenshot,
} from "../../services/templateScreenshot";
import { renderCheckoutEmailHtml } from "../../services/checkoutEmailHtml";
import { logger } from "../../lib/logger";
import { createShortLink } from "../../services/shortLinks";
import { env as envForRecap } from "../../lib/env";
import { TIERS, TierKey } from "@workspace/api-zod";
import { createCheckoutSession, stripe } from "../../integrations/stripe";
import { randomToken } from "../../lib/tokens";

const router: IRouter = Router();

router.use("/dashboard", requireAuth, requireOnboardingComplete);

router.get(
  "/dashboard/leads/available",
  asyncHandler(async (req, res) => {
    const filters = z
      .object({
        city: z.string().optional(),
        specialty: z.string().optional(),
        // Substring (case-insensitive) match on practitioner name OR
        // practice name. Capped at 80 chars to avoid abusive queries
        // building huge LIKE patterns. See getAvailableLeads for the
        // SQL-side normalization (trim + lowercase + %wrap%).
        name: z.string().max(80).optional(),
        // "Top quality only" flag — when "true" filters to leads whose
        // computed score puts them in tier A (≥ 37 after the #221
        // recalibration against the actual prod distribution). #212.
        topQualityOnly: z
          .union([z.literal("true"), z.literal("false")])
          .optional()
          .transform((v) => v === "true"),
        // Website presence filter — "yes" / "no" / undefined (all).
        hasWebsite: z.enum(["yes", "no"]).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
        // Column-header sorting (#221). Default = score DESC (the
        // historical behavior). Whitelist sortable columns server-side
        // so the SQL ORDER BY is never dynamic from raw client input.
        sortBy: z
          .enum(["score", "name", "city", "practice", "specialty"])
          .optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
      })
      .parse(req.query);
    const result = await getAvailableLeads(filters);
    res.json({
      leads: dateToIso(result.rows),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
      // Daily claim cap removed; sentinel kept for client compatibility.
      claimsRemainingToday: Number.MAX_SAFE_INTEGER,
    });
  }),
);

router.get(
  "/dashboard/leads/mine",
  asyncHandler(async (req, res) => {
    const filter = z
      .enum(["active", "nurturing", "won", "disqualified", "cold", "all"])
      .default("active")
      .parse(req.query.filter);
    const name = z.string().max(128).optional().parse(req.query.name);
    const rows = await getRepLeads(req.user!.id, filter, name);
    res.json({ leads: dateToIso(rows) });
  }),
);

// Leads owned by the current rep that have a hot-alert within the last 60
// minutes (mirrors the 🔥 badge on LeadDetail). Ordered by most-recent alert
// so reps see the leads to call right now at the top of the dashboard.
router.get(
  "/dashboard/leads/hot",
  asyncHandler(async (req, res) => {
    const rows = await getHotLeadsForRep(req.user!.id);
    res.json({ leads: dateToIso(rows) });
  }),
);

router.post(
  "/dashboard/leads/:id/claim",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const result = await claimLead(req.user!.id, id);
    res.json({
      lead: dateToIso(result.lead),
      claimsRemainingToday: result.claimsRemainingToday,
    });
  }),
);

// 2026-05-21 — atomic "Claim this lead" (Sprint 1). Replaces the legacy
// claim → nurture two-call dance the frontend was running.
router.post(
  "/dashboard/leads/:id/start-work",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const lead = await startWorkOnLead(req.user!.id, id);
    res.json({ lead: dateToIso(lead) });
  }),
);

// 2026-05-21 — Change requests (Sprint 2). Clients submit via the
// public portal route; rep reads/resolves here.
router.get(
  "/dashboard/leads/:id/change-requests",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { db: dbInst, changeRequests } = await import("@workspace/db");
    const { desc, eq: eqFn } = await import("drizzle-orm");
    const rows = await dbInst
      .select()
      .from(changeRequests)
      .where(eqFn(changeRequests.leadId, id))
      .orderBy(desc(changeRequests.createdAt));
    res.json({
      requests: rows.map((r) => ({
        id: r.id,
        body: r.body,
        status: r.status,
        submittedVia: r.submittedVia,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        resolvedByRepId: r.resolvedByRepId,
      })),
    });
  }),
);

router.post(
  "/dashboard/leads/:id/change-requests/:reqId/resolve",
  asyncHandler(async (req, res) => {
    const reqId = z.coerce.number().int().parse(req.params.reqId);
    const { db: dbInst, changeRequests } = await import("@workspace/db");
    const { eq: eqFn } = await import("drizzle-orm");
    const [updated] = await dbInst
      .update(changeRequests)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedByRepId: req.user!.id,
      })
      .where(eqFn(changeRequests.id, reqId))
      .returning();
    res.json({
      request: updated && {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      },
    });
  }),
);

router.patch(
  "/dashboard/leads/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const patch = UpdateLeadRequest.parse(req.body);
    const updated = await updateLeadByRep(req.user!.id, id, patch, req);
    res.json({ lead: dateToIso(updated) });
  }),
);

// Rep-notes journal (#229, 2026-05-11; edit path added #231, 2026-05-14).
// Timestamped feed — each new submit is its own row so the chronological
// history stays trustworthy. Reps CAN now edit their own notes (PATCH),
// but the original body is preserved on the row (`originalBody`) so the
// UI can show a "modified" tag with the pre-edit text on hover. Only
// the original author can edit; admins cannot.
router.get(
  "/dashboard/leads/:id/rep-notes",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const rows = await listLeadRepNotes(req.user!.id, id);
    res.json({ notes: dateToIso(rows) });
  }),
);

router.post(
  "/dashboard/leads/:id/rep-notes",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = AddLeadRepNoteRequest.parse(req.body);
    const note = await addLeadRepNote(req.user!.id, id, body.body);
    res.json({ note: dateToIso(note) });
  }),
);

// #231 (2026-05-14) — rep edits their own note. Ownership is enforced
// in the service (author == current rep + lead still owned by rep).
// Reuses `AddLeadRepNoteRequest` for the body shape ({ body: string }).
router.patch(
  "/dashboard/leads/:id/rep-notes/:noteId",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const noteId = z.coerce.number().int().parse(req.params.noteId);
    const body = AddLeadRepNoteRequest.parse(req.body);
    const note = await editLeadRepNote(req.user!.id, id, noteId, body.body);
    res.json({ note: dateToIso(note) });
  }),
);

// 2026-05-14: rep-side template selector. The public-portal PATCH already
// existed (routes/public/portals.ts), but the rep had no way to set the
// initial template without sending the link to the prospect first — which
// meant every new portal defaulted to "garden" until the prospect picked
// something. Audit 2026-05-14, fix #2.
const SUPPORTED_TEMPLATES = new Set([
  "atrium",
  "garden",
  "sunrise",
  "polaroid",
  "playful_modern",
  "constellation",
  "front_porch",
  "hello_friend",
  "quiet_practice",
]);
const SetTemplateBody = z.object({
  templateKey: z
    .string()
    .refine((v) => SUPPORTED_TEMPLATES.has(v), "Unsupported template key"),
});
router.patch(
  "/dashboard/leads/:id/template",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { templateKey } = SetTemplateBody.parse(req.body);
    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, id))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id) {
      throw badRequest("You don't own this lead.");
    }
    const portal = await ensurePortalForLead(id);
    const from = portal.selectedTemplate;
    await patchPortalCustomizations(portal.slug, { selectedTemplate: templateKey });
    await writeAudit(req, {
      action: "lead.template_changed",
      targetType: "lead",
      targetId: id,
      before: { selectedTemplate: from },
      after: { selectedTemplate: templateKey },
    });
    res.json({ selectedTemplate: templateKey });
  }),
);

// 2026-05-14: manual hero image override for the rep. The enrichment
// pipeline sometimes can't find a PT/Headway/first-party photo and the
// preview ships without a hero image (Mary D Jackson case). Rather than
// fall back to a generic stock photo (policy: never fake a clinician's
// face), the rep pastes a URL they have on hand (Google Places photo,
// the practice's site, the practitioner's PT profile photo).
const HERO_IMAGE_URL_MAX = 1024;
const SetHeroImageBody = z.object({
  heroImageUrl: z
    .string()
    .trim()
    .max(HERO_IMAGE_URL_MAX)
    .nullable()
    .refine((v) => v === null || /^https:\/\//.test(v), "Must be an https URL"),
});
router.patch(
  "/dashboard/leads/:id/hero-image",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { heroImageUrl } = SetHeroImageBody.parse(req.body);
    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, id))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id) {
      throw badRequest("You don't own this lead.");
    }
    const portal = await ensurePortalForLead(id);
    const before = (portal.customizations as { heroImageUrl?: string } | null)
      ?.heroImageUrl ?? null;
    const nextCustomizations = {
      ...((portal.customizations as Record<string, unknown> | null) ?? {}),
    };
    if (heroImageUrl) {
      nextCustomizations.heroImageUrl = heroImageUrl;
    } else {
      delete (nextCustomizations as { heroImageUrl?: string }).heroImageUrl;
    }
    await db
      .update(prospectPortals)
      .set({
        customizations: nextCustomizations,
        updatedAt: new Date(),
      })
      .where(eq(prospectPortals.id, portal.id));
    await writeAudit(req, {
      action: "lead.hero_image_set",
      targetType: "lead",
      targetId: id,
      before: { heroImageUrl: before },
      after: { heroImageUrl },
    });
    res.json({ heroImageUrl });
  }),
);

// 2026-05-14 follow-up: rep-chosen pricing plan attached to the portal at
// the moment the rep sends the preview email. Surfaces in the rep's
// "Send preview email" modal alongside the template picker; the value
// drives downstream payment-link generation.
const SetPricingPlanBody = z.object({
  plan: TierKey,
});
router.patch(
  "/dashboard/leads/:id/pricing-plan",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { plan } = SetPricingPlanBody.parse(req.body);
    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, id))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id) {
      throw badRequest("You don't own this lead.");
    }
    const portal = await ensurePortalForLead(id);
    const before =
      (portal.customizations as { pricingPlan?: string } | null)?.pricingPlan ??
      null;
    await patchPortalCustomizations(portal.slug, {
      customizations: { pricingPlan: plan },
    });
    await writeAudit(req, {
      action: "lead.pricing_plan_changed",
      targetType: "lead",
      targetId: id,
      before: { pricingPlan: before },
      after: { pricingPlan: plan },
    });
    res.json({ pricingPlan: plan });
  }),
);

/**
 * Sales-only domain setter. The prospect-facing DomainPicker was retired
 * on 2026-04-28 (#185 Comms & Copy Hardening) — picking the practice
 * domain is now a conversation between rep and lead during onboarding.
 * The rep dashboard uses this endpoint to persist their pick onto the
 * lead row so it carries forward into the portal preview link, the
 * Stripe Checkout session, and the post-payment onboarding worksheet.
 *
 * Stored under `selfServeMeta.chosenDomain` to reuse the existing jsonb
 * column that already serves the same role for self-serve leads — avoids
 * a schema migration for a single optional string. Pass `null` (or an
 * empty string) to clear a previously-set value.
 */
// Loose RFC-1035-ish FQDN check: 1+ labels, hyphens allowed but not at
// boundaries, plus a final TLD label. We don't try to enforce the full
// registrar contract here — Stripe/onboarding will reject garbage
// downstream — but it does keep obvious junk ("hello world", " ", etc.)
// out of the lead row and the portal preview link.
const FQDN_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const SetChosenDomainBody = z.object({
  chosenDomain: z
    .string()
    .trim()
    .max(253)
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
    .refine(
      (v) => v === null || FQDN_RE.test(v),
      "Domain must look like example.com",
    ),
});
router.patch(
  "/dashboard/leads/:id/chosen-domain",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { chosenDomain } = SetChosenDomainBody.parse(req.body);
    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, id))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id) {
      throw badRequest("You don't own this lead.");
    }
    const nextMeta = {
      ...(lead.selfServeMeta ?? {}),
      ...(chosenDomain ? { chosenDomain } : {}),
    };
    if (!chosenDomain) delete (nextMeta as { chosenDomain?: string }).chosenDomain;
    const [updated] = await db
      .update(leadsTbl)
      .set({
        selfServeMeta: nextMeta,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadsTbl.id, id))
      .returning();
    res.json({
      chosenDomain: updated?.selfServeMeta?.chosenDomain ?? null,
    });
  }),
);

const GenerateLinkBody = z
  .object({
    channels: z
      .object({ sms: z.boolean(), email: z.boolean() })
      .refine((c) => c.sms || c.email, {
        message: "At least one channel (SMS or email) must be selected.",
      })
      .optional(),
    phoneOverride: z.string().min(7).max(32).optional(),
    emailOverride: z.string().email().nullable().optional(),
    // Two-step send flow: when the rep edits the rendered preview email
    // before sending, these arrive populated. Empty/omitted means "use the
    // server-rendered defaults" (preserves back-compat for callers that
    // skip the preview step entirely).
    subjectOverride: z.string().min(1).max(300).optional(),
    bodyOverride: z.string().min(1).max(20_000).optional(),
    smsBodyOverride: z.string().min(1).max(1600).optional(),
  })
  .optional();

const DraftPreviewLinkBody = z
  .object({
    phoneOverride: z.string().min(7).max(32).optional(),
    emailOverride: z.string().email().nullable().optional(),
  })
  .optional();

router.post(
  "/dashboard/leads/preview-link",
  asyncHandler(async (req, res) => {
    const body = CreatePreviewLinkRequest.parse(req.body);
    const result = await createPreviewLink(req.user!.id, body.leadId);
    res.json({
      token: result.token,
      url: result.url,
      smsStatus: result.smsStatus,
      emailStatus: result.emailStatus,
    });
  }),
);

// Spec path: POST /dashboard/leads/:id/generate-link
//
// Legacy alias kept for the rep dashboard's "Generate & send preview" modal.
// Now routes through the new bilingual portal-invite path so we never silently
// drop sends. The legacy `prospectLinks` mint is preserved purely for the
// callback-recap flow which still references the most recent link row, but
// the actual SMS+email is delegated to `sendPortalInvite`.
router.post(
  "/dashboard/leads/:id/generate-link",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = GenerateLinkBody.parse(req.body ?? {}) ?? {};

    // Load the lead and verify ownership. Phone/email overrides are
    // applied IN-MEMORY for this send only — we deliberately do NOT
    // persist them back to the lead row. Founder policy (#225,
    // 2026-05-08): a corrected "to" address sends only to that address
    // for the current send and the lead's saved contact info is left
    // untouched, so a typo in the modal can't permanently overwrite a
    // good email/phone.
    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, id))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id)
      throw badRequest("You don't own this lead.");

    // Mint the legacy prospect_links row too so the callback-recap can still
    // resolve `getLatestLinkForLead`. No SMS/email goes out via this path.
    //
    // IMPORTANT (#225): we deliberately drop the phone/email overrides
    // here — `createPreviewLink` would otherwise persist them onto the
    // lead row, which is exactly the bug this task fixes. The overrides
    // flow through to `sendPortalInvite` below as in-memory `sendPhone`
    // / `sendEmail` only.
    const legacy = await createPreviewLink(req.user!.id, id, {
      channels: body?.channels,
    });

    const sendPhone =
      body?.phoneOverride !== undefined && body.phoneOverride.trim()
        ? body.phoneOverride.trim()
        : lead.phone;
    const sendEmail =
      body?.emailOverride !== undefined
        ? body.emailOverride && body.emailOverride.trim()
          ? body.emailOverride.trim()
          : null
        : lead.email;

    const result = await sendPortalInvite({
      repId: req.user!.id,
      repDisplayName: req.user!.displayName,
      lead: {
        id: lead.id,
        name: lead.name,
        practice: lead.practice,
        phone: sendPhone,
        email: sendEmail,
        locale: lead.locale,
      },
      // Honour the rep's channel selection from the modal (zod default in
      // GenerateLinkBody is { sms: true, email: true } when omitted).
      channels: body?.channels,
      subjectOverride: body?.subjectOverride,
      textBodyOverride: body?.bodyOverride,
      smsBodyOverride: body?.smsBodyOverride,
    });

    res.json({
      token: legacy.token,
      url: result.url,
      smsStatus: result.smsStatus,
      emailStatus: result.emailStatus,
    });
  }),
);

// Two-step send flow: render the day-1 portal invite (subject + plain-text
// body + SMS body) without sending or marking the invite as sent. The rep
// reviews and optionally edits the output in the modal, then POSTs to
// `/generate-link` with the (possibly edited) subject/body to actually send.
router.post(
  "/dashboard/leads/:id/generate-link/draft",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = DraftPreviewLinkBody.parse(req.body ?? {}) ?? {};

    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, id))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id)
      throw badRequest("You don't own this lead.");

    const sendPhone =
      body?.phoneOverride !== undefined && body.phoneOverride.trim()
        ? body.phoneOverride.trim()
        : lead.phone;
    const sendEmail =
      body?.emailOverride !== undefined
        ? body.emailOverride && body.emailOverride.trim()
          ? body.emailOverride.trim()
          : null
        : lead.email;

    const draft = await renderPortalInviteDraft({
      repDisplayName: req.user!.displayName,
      lead: {
        id: lead.id,
        name: lead.name,
        practice: lead.practice,
        phone: sendPhone,
        email: sendEmail,
        locale: lead.locale,
      },
    });
    res.json({
      subject: draft.subject,
      body: draft.textBody,
      smsBody: draft.smsBody,
      previewUrl: draft.shortUrl,
    });
  }),
);

const SendPaymentLinkBody = z.object({
  // Phase 1B-c canonical field. Tolerated as optional for one deploy so
  // older rep-app clients (still posting only planKey/addonKeys) don't
  // 400 mid-rollout; falls back to `boutique` server-side.
  tierKey: TierKey.optional(),
  // Legacy fields — retained on the schema so older clients still POST
  // successfully, but ignored server-side. Removed in 1B-c-2 once the
  // rep app stops sending them.
  planKey: z.enum(["A", "B"]).optional(),
  addonKeys: z.array(z.string().max(64)).max(20).default([]),
  channels: z
    .object({ sms: z.boolean(), email: z.boolean() })
    .refine((c) => c.sms || c.email, {
      message: "At least one channel (SMS or email) must be selected.",
    }),
  phoneOverride: z.string().min(7).max(32).optional(),
  emailOverride: z.string().email().nullable().optional(),
});

router.post(
  "/dashboard/leads/:id/send-payment-link",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = SendPaymentLinkBody.parse(req.body);

    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, id))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id)
      throw badRequest("You don't own this lead.");

    // Tier-driven pricing (Phase 1B-c). The rep dashboard's send-payment-link
    // modal posts a tierKey; legacy clients without one fall back to the
    // Boutique floor tier. addonKeys is retained on the body schema but
    // ignored here — tiers don't compose addons.
    const tierKey: TierKey = body.tierKey ?? "boutique";
    const validAddonKeys: string[] = [];
    const monthlyTotalCents = TIERS[tierKey].monthlyCents;
    const setupCents = TIERS[tierKey].setupCents;
    const tierLabel = TIERS[tierKey].label;

    // Build the Stripe Checkout session (or dev mock).
    const phone =
      body.phoneOverride && body.phoneOverride.trim()
        ? body.phoneOverride.trim()
        : lead.phone;
    const emailOverrideProvided = body.emailOverride !== undefined;
    const email = emailOverrideProvided
      ? (body.emailOverride && body.emailOverride.trim()
          ? body.emailOverride.trim()
          : null)
      : lead.email;

    const successUrl = `${envForRecap.publicBaseUrl}/checkout/success`;
    const cancelUrl = `${envForRecap.publicBaseUrl}/checkout/cancel`;

    // Resolve checkout URL with the same fallback hierarchy used by the
    // public preview path: real Stripe Checkout if configured, otherwise the
    // static Stripe Payment Link with metadata prefill, otherwise dev mock.
    let checkoutUrl: string;
    let checkoutSessionId: string | null = null;
    let checkoutMode: "stripe_checkout" | "payment_link" | "dev_mock" =
      "dev_mock";
    const buildStaticPaymentLinkUrl = () => {
      if (!envForRecap.stripeProspectPaymentLink) return null;
      const u = new URL(envForRecap.stripeProspectPaymentLink);
      u.searchParams.set("client_reference_id", String(id));
      if (email) u.searchParams.set("prefilled_email", email);
      u.searchParams.set("metadata[tierKey]", tierKey);
      u.searchParams.set("metadata[leadId]", String(id));
      u.searchParams.set("metadata[repId]", String(req.user!.id));
      u.searchParams.set("metadata[source]", "rep_payment_link");
      if (validAddonKeys.length) {
        u.searchParams.set("metadata[addonKeys]", validAddonKeys.join(","));
      }
      if (req.user!.promoCode) {
        u.searchParams.set("prefilled_promo_code", req.user!.promoCode);
        u.searchParams.set("metadata[repPromoCode]", req.user!.promoCode);
      }
      return u.toString();
    };

    if (stripe) {
      try {
        const result = await createCheckoutSession({
          tierKey,
          monthlyTotalCents,
          setupCents,
          promoCode: req.user!.promoCode ?? undefined,
          leadId: id,
          repId: req.user!.id,
          customerEmail: email ?? undefined,
          successUrl,
          cancelUrl,
          // No customer IP available on the rep flow — the rep generates the link
          // and the customer completes Checkout from their own device, so
          // acceptedTermsIp is left empty and acceptedTermsAt + version still
          // get stamped from the consent_collection result.
        });
        checkoutUrl = result.url;
        checkoutSessionId = result.sessionId;
        checkoutMode = "stripe_checkout";
      } catch (err) {
        // Degrade gracefully like the public preview route does: fall back to
        // the static Stripe Payment Link if configured, otherwise the dev mock.
        const staticUrl = buildStaticPaymentLinkUrl();
        if (staticUrl) {
          checkoutUrl = staticUrl;
          checkoutMode = "payment_link";
        } else {
          const result = await createCheckoutSession({
            tierKey,
            monthlyTotalCents,
            setupCents,
            promoCode: req.user!.promoCode ?? undefined,
            leadId: id,
            repId: req.user!.id,
            customerEmail: email ?? undefined,
            successUrl,
            cancelUrl,
          });
          checkoutUrl = result.url;
          checkoutSessionId = result.sessionId;
        }
      }
    } else if (envForRecap.stripeProspectPaymentLink) {
      const u = new URL(envForRecap.stripeProspectPaymentLink);
      u.searchParams.set("client_reference_id", String(id));
      if (email) u.searchParams.set("prefilled_email", email);
      u.searchParams.set("metadata[tierKey]", tierKey);
      u.searchParams.set("metadata[leadId]", String(id));
      u.searchParams.set("metadata[repId]", String(req.user!.id));
      u.searchParams.set("metadata[source]", "rep_payment_link");
      if (validAddonKeys.length) {
        u.searchParams.set("metadata[addonKeys]", validAddonKeys.join(","));
      }
      if (req.user!.promoCode) {
        u.searchParams.set("prefilled_promo_code", req.user!.promoCode);
        u.searchParams.set("metadata[repPromoCode]", req.user!.promoCode);
      }
      checkoutUrl = u.toString();
      checkoutMode = "payment_link";
    } else {
      const result = await createCheckoutSession({
        tierKey,
        monthlyTotalCents,
        setupCents,
        promoCode: req.user!.promoCode ?? undefined,
        leadId: id,
        repId: req.user!.id,
        customerEmail: email ?? undefined,
        successUrl,
        cancelUrl,
      });
      checkoutUrl = result.url;
      checkoutSessionId = result.sessionId;
    }

    // Compose messages.
    const firstName = req.user!.displayName.split(" ")[0];
    const leadFirstName = lead.name.split(" ")[0];
    const locale: "en" | "es" = lead.locale === "es" ? "es" : "en";
    const dollarsMonthly = (monthlyTotalCents / 100).toFixed(2);
    // Localized parenthetical that follows the monthly price line. The
    // EN form is reused by SMS, the EN email, and the rep-facing
    // timeline detail. The ES form is only consumed by the Spanish
    // plain-text email branch — interpolating English text into a
    // Spanish body looked sloppy and was flagged in code review.
    const setupNote = setupCents > 0
      ? ` (one-time $${(setupCents / 100).toFixed(2)} setup)`
      : " (no setup fee)";
    const setupNoteEs = setupCents > 0
      ? ` (configuración única de $${(setupCents / 100).toFixed(2)})`
      : " (sin costo de configuración)";
    const addonLabels: string[] = [];
    const smsBody =
      `Hi ${leadFirstName} — your ${tierLabel} for ${lead.practice} ` +
      `is $${dollarsMonthly}/mo${setupNote}. Secure checkout: ${checkoutUrl}`;
    // 2026-04-30 — softened the subject from the original
    // "Your Ashford Creative checkout — Plan X for {practice}".
    // That phrasing tripped two of Candice's deliverability concerns:
    //   1) "checkout" + plan letter + practice name reads like a billing
    //      receipt to spam filters (and to the recipient).
    //   2) It pre-empts the prospect's reason to open by leading with
    //      the transaction, not the deliverable.
    // Lead with the practitioner's first name + practice instead — same
    // pattern as the cold drip sequence (Day 1: "{name}, your draft is
    // ready"). The rest of the email still confirms plan + price inside
    // the card; the subject just has to earn the open.
    const emailSubject =
      locale === "es"
        ? `${leadFirstName}, listo para publicar ${lead.practice}`
        : `${leadFirstName}, ready to publish ${lead.practice}`;

    // Plain-text fallback. Non-HTML clients (Outlook safe-mode, screen
    // readers, terminal mail clients) render this verbatim — and spam
    // scoring parses it too. Two rules here:
    //   1) Mirror the softened "preview-first" tone of the HTML envelope
    //      so the two parts don't disagree. Promotional language ("secure
    //      checkout", price up front) in the text part undoes the work
    //      we did on the HTML side. Candice's 2026-04-28 screenshot
    //      caught this and 2026-04-30 fixed it.
    //   2) Carry the long checkout URL inline — it's the only way a
    //      text-only client can complete checkout. The HTML side never
    //      duplicates this URL inline (the CTA button's `href` is the
    //      only carrier) so Gmail doesn't render the link as a ten-line
    //      wall of unbreakable text.
    // Batch 4.c — Phase B "what's new" lines for the plain-text fallback.
    // Derived from the same tier-capability filter we use for the HTML
    // renderer; bilingual; suppressed entirely when the tier has none of
    // the four (defensive — boutique still ships intake_forms_hub but the
    // free bundled-add-on case is handled separately).
    const phaseBHighlightLines = [
      {
        included: TIERS[tierKey].capabilities.includes("telehealth_bridge") ||
          TIERS[tierKey].capabilities.includes("telehealth_full"),
        en: "Telehealth /visit — branded video session room on your own domain.",
        es: "Telesalud /visit — sala de video con tu marca en tu propio dominio.",
      },
      {
        included: TIERS[tierKey].capabilities.includes("online_booking"),
        en: "Online booking — clients pick a time, you one-tap approve.",
        es: "Reservación en línea — los pacientes eligen un horario, tú apruebas con un toque.",
      },
      // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
      {
        included: TIERS[tierKey].capabilities.includes("blog_publishing"),
        en: "Concierge ghostwriter — we draft a journal entry every month.",
        es: "Redactor fantasma conserje — redactamos una entrada del diario cada mes.",
      },
    ].filter((l) => l.included);

    const phaseBTextEn = phaseBHighlightLines.length
      ? `\n\nWhat's included that's new:\n` +
        phaseBHighlightLines.map((l) => `· ${l.en}`).join("\n")
      : "";
    const phaseBTextEs = phaseBHighlightLines.length
      ? `\n\nLo nuevo que está incluido:\n` +
        phaseBHighlightLines.map((l) => `· ${l.es}`).join("\n")
      : "";

    const emailBody =
      locale === "es"
        ? `Hola ${leadFirstName},\n\n` +
          `Tu sitio para ${lead.practice} está listo para que le eches un vistazo.\n\n` +
          `Cuando estés listo para activarlo, este enlace lo deja en vivo en tu dominio esta semana:\n${checkoutUrl}\n\n` +
          `Para tu referencia: ${tierLabel} — $${dollarsMonthly}/mes${setupNoteEs}` +
          (addonLabels.length ? `\nIncluye: ${addonLabels.join(", ")}` : "") +
          phaseBTextEs +
          `\nCancela cuando quieras. Lo alojamos y lo mantenemos nosotros.\n\n` +
          `Cualquier duda, responde a este correo.\n\n` +
          `— ${firstName}, Ashford Creative`
        : `Hi ${leadFirstName},\n\n` +
          `Your site for ${lead.practice} is ready for you to take a look.\n\n` +
          `When you're ready to put it live on your domain this week, this link will do it:\n${checkoutUrl}\n\n` +
          `For your reference: ${tierLabel} — $${dollarsMonthly}/mo${setupNote}` +
          (addonLabels.length ? `\nIncludes: ${addonLabels.join(", ")}` : "") +
          phaseBTextEn +
          `\nCancel anytime. Hosted and maintained by us.\n\n` +
          `Any questions, just reply to this email.\n\n` +
          `— ${firstName}, Ashford Creative`;

    const wantsSms = body.channels.sms;
    const wantsEmail = body.channels.email && !!email;

    // Resolve the hero screenshot URL up-front so the dedicated
    // "Preview-Led" HTML renderer can splash the prospect's actual draft
    // at the top of the email. We mint (or fetch) the lead's portal so we
    // get a stable slug + token, then point the recipient's mail client
    // at `/api/portal-screenshot/:slug.png?t=...`. We BLOCK up to ~10s
    // warming the cache so Gmail's image proxy gets an instant response
    // when the email lands — otherwise the proxy times out on a cold
    // capture and caches a broken image for the session. If warm-up
    // times out we still send (the on-demand fallback may eventually
    // succeed for re-opens). If we can't get a portal at all, the
    // renderer falls back to a clean cream brand header — never a
    // broken image.
    // Hero strategy (#224 architect review 2026-05): bound to a 3s
    // warm budget. If the screenshot isn't ready inside the budget we
    // ship the checkout email WITHOUT a hero <img> (renderer falls
    // back to CSS hero) so Gmail's proxy doesn't cache a fetch failure
    // for the recipient's session. The warm continues in the
    // background to populate the cache for re-opens.
    let heroImageUrl: string | undefined;
    if (wantsEmail) {
      try {
        const portal = await ensurePortalForLead(id);
        if (portal.accessToken) {
          const warmStart = Date.now();
          const HERO_WARM_BUDGET_MS = 3_000;
          const warmPromise = warmPortalScreenshot(
            portal.slug,
            portal.accessToken,
          );
          const winner = await Promise.race([
            warmPromise,
            new Promise<"budget">((r) =>
              setTimeout(() => r("budget"), HERO_WARM_BUDGET_MS),
            ),
          ]);
          if (winner === true) {
            heroImageUrl = buildPortalScreenshotUrl(
              portal.slug,
              portal.accessToken,
            );
          } else {
            logger.warn(
              {
                slug: portal.slug,
                leadId: id,
                elapsedMs: Date.now() - warmStart,
                reason:
                  winner === "budget" ? "budget_exceeded" : "warm_failed",
              },
              "send-payment-link: hero not ready inside 3s budget — checkout email will render without <img> (CSS hero fallback)",
            );
            void warmPromise.catch(() => undefined);
          }
        }
      } catch (err) {
        logger.warn(
          { err, leadId: id },
          "send-payment-link: portal resolution failed — checkout email will render without hero",
        );
      }
    }

    // Batch 4.c — Phase B "what's new" highlights derived from the quoted
    // tier's capability list. We surface the four marquee features bundled
    // in the proposal so prospects don't miss what they're getting. Only
    // features actually included in this tier are rendered; lower tiers get
    // a shorter list, Concierge gets all four.
    const tierCapsForPhaseB: ReadonlySet<string> = new Set(
      TIERS[tierKey].capabilities,
    );
    const phaseBHighlights = [
      {
        included: tierCapsForPhaseB.has("telehealth_bridge") || tierCapsForPhaseB.has("telehealth_full"),
        titleEn: "Telehealth /visit room",
        titleEs: "Sala de telesalud /visit",
        bodyEn:
          "A branded video session page on your own domain — clients land in the right room with no third-party Zoom link to share.",
        bodyEs:
          "Una sala de video con tu marca en tu propio dominio — el paciente entra al lugar correcto sin enlaces externos de Zoom.",
      },
      {
        included: tierCapsForPhaseB.has("online_booking"),
        titleEn: "Online booking",
        titleEs: "Reservación en línea",
        bodyEn:
          "Clients pick a time on your site without phoning. You one-tap approve from email or SMS — never double-booked.",
        bodyEs:
          "Los pacientes eligen un horario en tu sitio sin llamar. Apruebas con un toque desde correo o SMS — sin dobles reservas.",
      },
      // 2026-05-21 — `patient_onboarding_hub` capability dropped (Sprint 2 streamline).
      {
        included: tierCapsForPhaseB.has("blog_publishing"),
        titleEn: "Concierge ghostwriter",
        titleEs: "Redactor fantasma conserje",
        bodyEn:
          "We ghostwrite a journal entry every month from a 20-minute interview. You approve in one click, we publish.",
        bodyEs:
          "Escribimos una entrada del diario cada mes a partir de una entrevista de 20 minutos. Tú apruebas con un clic, nosotros publicamos.",
      },
    ].filter((h) => h.included);

    const checkoutHtml = wantsEmail
      ? renderCheckoutEmailHtml({
          leadFirstName,
          practice: lead.practice,
          tierLabel,
          monthlyPriceCents: monthlyTotalCents,
          setupCents,
          addonLabels,
          locale,
          ctaUrl: checkoutUrl,
          repFirstName: firstName,
          heroImageUrl,
          phaseBHighlights,
        })
      : undefined;

    const [smsR, emailR] = await Promise.allSettled([
      wantsSms
        ? sendSms({
            to: phone,
            body: smsBody,
            leadId: id,
            repId: req.user!.id,
            fromRepFirstName: firstName,
            // Rep-initiated recap SMS — same posture as the one-off
            // /dashboard/sms/send: never silently use the shared admin
            // number when per-rep OAuth is on but the rep isn't linked.
            requireRepAuth: true,
          })
        : Promise.resolve(null),
      wantsEmail && email
        ? sendEmail({
            to: email,
            subject: emailSubject,
            body: emailBody,
            leadId: id,
            repId: req.user!.id,
            fromRepFirstName: firstName,
            fromRepDisplayName: req.user!.displayName,
            locale,
            // The dedicated Preview-Led renderer takes over the HTML
            // envelope completely — no `ctaUrl` / `ctaLabel` / generic
            // wrapper. The plain-text `body` above still carries the URL
            // for non-HTML clients.
            htmlOverride: checkoutHtml,
          })
        : Promise.resolve(null),
    ]);

    // Bump last-activity only. Contact overrides (phone/email) are
    // intentionally NOT persisted here (#225) — the rep can target a
    // different "to" address for THIS payment-link send without
    // overwriting the saved contact info on the lead.
    await db
      .update(leadsTbl)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(leadsTbl.id, id));

    // Always record a timeline entry for the payment-link send. If no preview
    // link exists for this lead yet, mint a placeholder prospect-link row so
    // the event has somewhere to hang — reps need to see what they sent
    // regardless of whether they generated a preview first.
    let timelineLinkId: number;
    const latestLink = await getLatestLinkForLead(id);
    if (latestLink) {
      timelineLinkId = latestLink.id;
    } else {
      const [placeholder] = await db
        .insert(prospectLinksTbl)
        .values({
          token: `pmt_${randomToken(16)}`,
          leadId: id,
          repId: req.user!.id,
        })
        .returning();
      timelineLinkId = placeholder.id;
    }
    const timelineDetail =
      `${tierLabel} — $${dollarsMonthly}/mo${setupNote}` +
      (addonLabels.length ? `\nAdd-ons: ${addonLabels.join(", ")}` : "") +
      `\nMode: ${checkoutMode}`;
    const smsStatus = !wantsSms
      ? "skipped"
      : smsR.status === "fulfilled"
        ? (smsR.value?.status ?? "skipped")
        : "failed";
    const emailStatus = !body.channels.email
      ? "skipped"
      : !email
        ? "skipped_no_email"
        : emailR.status === "fulfilled"
          ? (emailR.value?.status ?? "skipped_no_email")
          : "failed";
    await recordLinkEvent({
      linkId: timelineLinkId,
      eventType: "payment_link_sent",
      templateKey: tierKey,
      changeRequestText: timelineDetail,
      metadata: {
        tierKey,
        monthlyTotalCents,
        setupCents,
        checkoutUrl,
        checkoutMode,
        channels: {
          sms: { requested: body.channels.sms, status: smsStatus },
          email: { requested: body.channels.email, status: emailStatus },
        },
      },
    });

    res.json({
      url: checkoutUrl,
      sessionId: checkoutSessionId,
      mode: checkoutMode,
      monthlyTotalCents,
      setupCents,
      smsStatus,
      emailStatus,
    });
  }),
);

const DisqualifyRequest = z.object({
  reason: z.enum([
    "not_interested",
    "wrong_number",
    "do_not_call",
    "already_has_provider",
    "out_of_market",
    "budget_concern",
    "other",
  ]),
  note: z.string().max(2000).optional(),
});

router.post(
  "/dashboard/leads/:id/disqualify",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = DisqualifyRequest.parse(req.body);
    const updated = await updateLeadByRep(
      req.user!.id,
      id,
      {
        status: "disqualified",
        disqualifyReason: body.reason,
        disqualifyNote: body.note,
      },
      req,
    );
    res.json({ lead: dateToIso(updated) });
  }),
);

const NurtureRequest = z.object({
  note: z.string().max(2000).optional(),
  callbackAt: z.string().datetime().optional(),
});

router.post(
  "/dashboard/leads/:id/nurture",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = NurtureRequest.parse(req.body);
    const updated = await updateLeadByRep(req.user!.id, id, {
      status: "nurturing",
      notes: body.note,
    });
    let callback;
    if (body.callbackAt) {
      const when = new Date(body.callbackAt);
      if (Number.isNaN(when.getTime())) throw badRequest("Invalid callbackAt.");
      callback = await scheduleCallback(req.user!.id, id, when, body.note);
    }
    res.json({ lead: dateToIso(updated), callback: callback ? dateToIso(callback) : null });
  }),
);

router.post(
  "/dashboard/leads/:id/cold",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const updated = await updateLeadByRep(req.user!.id, id, {
      status: "cold",
    });
    res.json({ lead: dateToIso(updated) });
  }),
);

router.post(
  "/dashboard/leads/:id/schedule-callback",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = ScheduleCallbackRequest.parse({ ...req.body, leadId: id });
    const when = new Date(body.scheduledFor);
    if (Number.isNaN(when.getTime())) throw badRequest("Invalid scheduledFor.");
    const cb = await scheduleCallback(req.user!.id, id, when, body.note);

    // Optional "see you tomorrow" recap with preview link re-attached.
    let recapSmsStatus: string | null = null;
    let recapEmailStatus: string | null = null;
    if (body.sendRecap) {
      const [lead] = await db
        .select()
        .from(leadsTbl)
        .where(eq(leadsTbl.id, id))
        .limit(1);
      if (!lead) throw notFound("Lead not found");
      // Find the most recent preview link for this lead so we can re-attach
      // it. We mint a short link wrapping the long /p/<token> URL so the SMS
      // stays GSM-7 safe and one-segment-friendly on the prod custom domain.
      const link = await getLatestLinkForLead(id);
      let previewShortUrl: string | null = null;
      if (link) {
        const longLinkUrl = `${envForRecap.publicBaseUrl}/p/${link.token}`;
        const { url } = await createShortLink(longLinkUrl, {
          leadId: id,
          purpose: "callback_recap",
        });
        previewShortUrl = url;
      }
      const firstName = req.user!.displayName.split(" ")[0];
      const locale: "en" | "es" = lead.locale === "es" ? "es" : "en";
      const leadFirst = lead.name.split(" ")[0];
      const whenLocal = when.toLocaleString(
        locale === "es" ? "es-US" : "en-US",
        {
          timeZone: "America/Chicago",
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      );
      // SMS bodies stay GSM-7 safe (no em-dash, ASCII hyphens only).
      const smsBody =
        locale === "es"
          ? `Hola ${leadFirst}, confirmo nuestra llamada el ${whenLocal} (CT). ` +
            (previewShortUrl
              ? `Tu vista previa sigue aquí: ${previewShortUrl}`
              : "Hablamos pronto.") +
            ` - ${firstName}`
          : `Hi ${leadFirst}, confirming our call ${whenLocal} (CT). ` +
            (previewShortUrl
              ? `Your preview is still here: ${previewShortUrl}`
              : "Talk soon!") +
            ` - ${firstName}`;
      const emailSubject =
        locale === "es"
          ? `Nos vemos el ${whenLocal} - ${lead.practice}`
          : `See you ${whenLocal} - ${lead.practice}`;
      const emailBody =
        locale === "es"
          ? `Hola ${leadFirst},\n\n` +
            `Confirmo nuestra breve llamada el ${whenLocal} (hora de Texas). ` +
            (previewShortUrl
              ? `Si quieres, revisa la vista previa antes - sigue activa aquí:\n\n${previewShortUrl}\n\n`
              : "\n") +
            `Quedo atento(a).\n\n- ${firstName}, Ashford Creative`
          : `Hi ${leadFirst},\n\n` +
            `Just confirming our quick call on ${whenLocal} (Texas time). ` +
            (previewShortUrl
              ? `Feel free to revisit the preview before then - it's still live here:\n\n${previewShortUrl}\n\n`
              : "\n") +
            `Looking forward to it.\n\n- ${firstName}, Ashford Creative`;

      const [smsR, emailR] = await Promise.allSettled([
        sendSms({
          to: lead.phone,
          body: smsBody,
          leadId: lead.id,
          repId: req.user!.id,
          fromRepFirstName: firstName,
          // Schedule-callback recap is rep-initiated — same posture as
          // /dashboard/sms/send. Never silently fall back to a shared
          // SMS provider when per-rep OAuth is configured.
          requireRepAuth: true,
        }),
        lead.email
          ? sendEmail({
              to: lead.email,
              subject: emailSubject,
              body: emailBody,
              leadId: lead.id,
              repId: req.user!.id,
              fromRepFirstName: firstName,
              fromRepDisplayName: req.user!.displayName,
            })
          : Promise.resolve(null),
      ]);
      recapSmsStatus =
        smsR.status === "fulfilled" ? smsR.value.status : "failed";
      recapEmailStatus =
        emailR.status === "fulfilled"
          ? (emailR.value?.status ?? "skipped_no_email")
          : "failed";
    }

    res.json({
      callback: dateToIso(cb),
      recapSmsStatus,
      recapEmailStatus,
    });
  }),
);

// LOT 1.1: per-rep token bucket — 60 reads / 5 min (refill 60/300s).
// Sits AFTER the router-level `requireAuth` middleware so `req.user!.id`
// is always populated when the keyFn fires. Stops bulk PII enumeration
// of the available pool by a compromised rep session.
const leadDetailReadLimit = rateLimit({
  name: "lead-detail-read",
  capacity: 60,
  refillPerSecond: 60 / 300,
  keyFn: (req) => `rep:${req.user!.id}`,
});

router.get(
  "/dashboard/leads/:id",
  leadDetailReadLimit,
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const timeline = await getLeadTimeline(id, req.user!.id);
    // LOT 1.2: routed through the audit helper now that the schema has
    // dedicated columns for ip / user_agent / actor_role. The 1.1
    // compromise (stuffing context into the legacy `diff` jsonb) is
    // gone — `after.redacted` carries the read-scope flag instead.
    await writeAudit(req, {
      action: "lead.read",
      targetType: "lead",
      targetId: id,
      before: null,
      after: { redacted: timeline.redacted },
    });
    res.json(dateToIso(timeline));
  }),
);

router.post(
  "/dashboard/callbacks",
  asyncHandler(async (req, res) => {
    const body = ScheduleCallbackRequest.parse(req.body);
    const when = new Date(body.scheduledFor);
    if (Number.isNaN(when.getTime())) throw badRequest("Invalid scheduledFor.");
    const cb = await scheduleCallback(
      req.user!.id,
      body.leadId,
      when,
      body.note,
    );
    res.json({ callback: dateToIso(cb) });
  }),
);

router.get(
  "/dashboard/callbacks",
  asyncHandler(async (req, res) => {
    const rows = await getRepCallbacks(req.user!.id);
    res.json({ callbacks: dateToIso(rows) });
  }),
);

router.post(
  "/dashboard/sms/send",
  asyncHandler(async (req, res) => {
    const body = SendSmsRequest.parse(req.body);
    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, body.leadId))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id)
      throw badRequest("You don't own this lead.");
    const firstName = req.user!.displayName.split(" ")[0];
    let result;
    try {
      result = await sendSms({
        to: lead.phone,
        body: body.body,
        leadId: lead.id,
        repId: req.user!.id,
        fromRepFirstName: firstName,
        // Rep-initiated outbound SMS — never silently fall back to the
        // shared admin number. The Settings → Connect flow is the fix.
        requireRepAuth: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("DIALPAD_NOT_CONNECTED")) {
        res.status(409).json({
          error: {
            code: "dialpad_not_connected",
            message:
              "Connect your Dialpad in Settings before sending SMS so the prospect sees YOUR number.",
          },
        });
        return;
      }
      throw err;
    }
    res.json(result);
  }),
);

router.post(
  "/dashboard/email/send",
  asyncHandler(async (req, res) => {
    const body = SendEmailRequest.parse(req.body);
    const [lead] = await db
      .select()
      .from(leadsTbl)
      .where(eq(leadsTbl.id, body.leadId))
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.claimedByRepId !== req.user!.id)
      throw badRequest("You don't own this lead.");
    if (!lead.email) throw badRequest("Lead has no email on file.");
    const firstName = req.user!.displayName.split(" ")[0];
    const result = await sendEmail({
      to: lead.email,
      subject: body.subject,
      body: body.body,
      leadId: lead.id,
      repId: req.user!.id,
      fromRepFirstName: firstName,
      fromRepDisplayName: req.user!.displayName,
      // 1:1 rep-typed message — skip the branded envelope so Gmail keeps
      // it in Primary instead of routing to the Promotions tab.
      plain: true,
    });
    res.json(result);
  }),
);


// PATCH /dashboard/leads/:id/temperature — rep sets the granular
// temperature picker (disqualifier / cold / lukewarm / hot). Endpoint
// is owned-by-rep only; admin-only paths use a different mutation.
// Founder feedback 2026-05-17.
router.patch(
  "/dashboard/leads/:id/temperature",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    const body = z.object({
      temperature: z.enum(["disqualifier", "cold", "lukewarm", "hot"]).nullable(),
    }).parse(req.body);
    await loadOwnedLead(leadId, req.user!);
    await db.update(leadsTbl).set({ temperature: body.temperature }).where(eq(leadsTbl.id, leadId));
    res.json({ ok: true });
  }),
);

export default router;
