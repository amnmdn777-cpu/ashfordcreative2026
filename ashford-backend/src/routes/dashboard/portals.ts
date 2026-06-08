import { Router, type IRouter } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireOnboardingComplete } from "../../middleware/requireAuth";
import { rateLimit } from "../../middleware/rateLimit";
import { forbidden, notFound } from "../../lib/errors";
import { db, leads as leadsTbl } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ensurePortalForLead,
  regeneratePortalAccessToken,
  resetPortalCompletely,
  getPortalEnrichmentForLead,
} from "../../services/portals";
// 2026-05-21 — `briefing` service stubbed (Sprint 2 streamline). The rep
// pre-call AI briefing falls back to a static heuristic until restored.
import {
  runEnrichmentForLead,
  getLatestEnrichment,
  TOTAL_ENRICHMENT_SOURCES,
} from "../../integrations/enrichment/orchestrator";
import { sendPortalInvite } from "../../services/portalInvite";
import { buildLeadPortalView } from "../../services/leadPortalView";
import { renderLeadPreviewPdf } from "../../services/leadPreviewPdf";
import { renderLeadPreviewVideo } from "../../services/leadPreviewVideo";
import { env } from "../../lib/env";

const router: IRouter = Router();

router.use("/dashboard", requireAuth, requireOnboardingComplete);

const LeadIdParam = z.coerce.number().int().positive();

/**
 * Loads the lead and verifies the authenticated rep owns it (or is admin).
 * Throws 404 if the lead doesn't exist, 403 if the rep doesn't own it.
 */
const loadOwnedLead = async (
  leadId: number,
  user: { id: number; role?: string | null },
) => {
  const [lead] = await db.select().from(leadsTbl).where(eq(leadsTbl.id, leadId)).limit(1);
  if (!lead) throw notFound("Lead not found");
  const isAdmin = user.role === "admin" || user.role === "owner";
  if (!isAdmin && lead.claimedByRepId !== user.id) {
    throw forbidden("You don't own this lead.");
  }
  return lead;
};

/**
 * Read-side endpoint for the LeadDetail panel: returns the portal URL,
 * latest events, latest cart, latest enrichment.
 */
router.get(
  "/dashboard/leads/:id/portal",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    await loadOwnedLead(leadId, req.user!);
    res.json(await buildLeadPortalView(leadId));
  }),
);

/**
 * Send the portal invite over SMS + email in parallel. Both channels
 * fail-soft: a Twilio outage shouldn't block the email.
 */
router.post(
  "/dashboard/leads/:id/send-invite",
  rateLimit({ name: "send_portal_invite", capacity: 30, refillPerSecond: 0.2 }),
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    const lead = await loadOwnedLead(leadId, req.user!);
    const result = await sendPortalInvite({
      repId: req.user!.id,
      repDisplayName: req.user!.displayName,
      lead: {
        id: lead.id,
        name: lead.name,
        practice: lead.practice,
        phone: lead.phone,
        email: lead.email,
        locale: lead.locale,
      },
    });
    res.json({
      ok: true,
      url: result.url,
      longUrl: result.longUrl,
      slug: result.slug,
      sms: result.sms,
      email: result.email,
    });
  }),
);

/**
 * Manual enrichment refresh. Returns the latest enrichment rows after running.
 */
router.post(
  "/dashboard/leads/:id/enrich",
  rateLimit({ name: "manual_enrich", capacity: 20, refillPerSecond: 0.2 }),
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    await loadOwnedLead(leadId, req.user!);
    const summary = await runEnrichmentForLead(leadId, "manual");
    const [enrichment, fieldEnrichment] = await Promise.all([
      getLatestEnrichment(leadId),
      getPortalEnrichmentForLead(leadId),
    ]);
    res.json({
      ok: true,
      summary,
      enrichment: enrichment.map((row) => ({
        sourceKey: row.sourceKey,
        confidence: row.confidence,
        summary: row.summary,
        fetchedAt: row.fetchedAt,
      })),
      enrichmentCompleteness: {
        sourcesAvailable: enrichment.length,
        sourcesTotal: TOTAL_ENRICHMENT_SOURCES,
      },
      fieldsCompleteness: fieldEnrichment?.fieldsCompleteness ?? {
        filled: 0,
        total: 10,
      },
      fieldSources: fieldEnrichment?.fieldSources ?? {},
    });
  }),
);

/**
 * Full preview reset (founder fix #228). Wipes the portal customizations,
 * resets the template to the specialty default, mints a fresh access
 * token, clears the lead's self-serve metadata, deletes cached enrichment
 * rows, then re-runs the enrichment pipeline so the rep gets a clean
 * brand-new preview every time she clicks "Prepare preview". Returns the
 * same enrichment summary shape as `/enrich` so the UI can flip
 * `previewReady` true off the response without a second round trip.
 */
router.post(
  "/dashboard/leads/:id/portal/reset",
  rateLimit({ name: "portal_reset", capacity: 12, refillPerSecond: 0.1 }),
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    await loadOwnedLead(leadId, req.user!);
    await resetPortalCompletely(leadId);
    const summary = await runEnrichmentForLead(leadId, "manual");
    const [enrichment, fieldEnrichment] = await Promise.all([
      getLatestEnrichment(leadId),
      getPortalEnrichmentForLead(leadId),
    ]);
    res.json({
      ok: true,
      summary,
      enrichment: enrichment.map((row) => ({
        sourceKey: row.sourceKey,
        confidence: row.confidence,
        summary: row.summary,
        fetchedAt: row.fetchedAt,
      })),
      enrichmentCompleteness: {
        sourcesAvailable: enrichment.length,
        sourcesTotal: TOTAL_ENRICHMENT_SOURCES,
      },
      fieldsCompleteness: fieldEnrichment?.fieldsCompleteness ?? {
        filled: 0,
        total: 10,
      },
      fieldSources: fieldEnrichment?.fieldSources ?? {},
    });
  }),
);

router.post(
  "/dashboard/leads/:id/portal/regenerate-token",
  rateLimit({ name: "portal_regenerate_token", capacity: 12, refillPerSecond: 0.1 }),
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    await loadOwnedLead(leadId, req.user!);
    const portal = await ensurePortalForLead(leadId);
    const updated = await regeneratePortalAccessToken(portal.id);
    res.json({
      ok: true,
      slug: updated.slug,
      url: `${env.publicBaseUrl}/preview/${updated.slug}?t=${encodeURIComponent(updated.accessToken)}`,
      accessTokenExpiresAt: updated.accessTokenExpiresAt,
    });
  }),
);

/**
 * AI briefing for the rep before a call. Soft-fails to a heuristic if no
 * LLM keys are configured.
 */
router.post(
  "/dashboard/leads/:id/briefing",
  rateLimit({ name: "briefing", capacity: 30, refillPerSecond: 0.2 }),
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    await loadOwnedLead(leadId, req.user!);
    // 2026-05-21 — AI briefing service stubbed. Return a heuristic
    // placeholder so the UI keeps working.
    res.json({
      summary: "AI briefing temporarily unavailable. Open the lead detail to review notes, timeline, and portal data manually.",
      talkingPoints: [],
      redFlags: [],
    });
  }),
);

const firstName = (full: string): string => {
  // Strip leading honorifics ("Dr.", "Dra.", "Mr.", "Ms.", "Mrs.",
  // "Mx.", "Prof.", "Rev.") — case-insensitive, optional trailing dot,
  // optional comma. This kept rendering "Dr. Dr." when the lead name
  // already started with "Dr." (founder feedback 2026-05-17: "What do
  // you mean Dr G?").
  const cleaned = full
    .trim()
    .replace(/^(?:dr|dra|mr|mrs|ms|mx|prof|rev)\.?\s+/i, "");
  // Split on whitespace AND commas so "Maya Alvarado, LCSW" → "Maya"
  // and "G. Carrera" → tokens=["G.","Carrera"].
  const tokens = cleaned.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return full;
  // If the first token is a single letter — possibly followed by a dot
  // — it's almost certainly a middle/given initial like "G." or "J.M."
  // The intended first name lives in the NEXT token. Without this we
  // shipped "Dr. G" greetings for leads whose Psychology Today profile
  // is filed as "G. Carrera". Founder feedback 2026-05-17.
  const looksLikeInitial = (tok: string): boolean =>
    /^[A-Za-z]\.?$/.test(tok) || /^[A-Za-z](?:\.[A-Za-z])+\.?$/.test(tok);
  for (const tok of tokens) {
    if (looksLikeInitial(tok)) continue;
    return tok;
  }
  // All tokens are single-letter initials (e.g. "J. M.") — fall back
  // to the first one rather than returning the empty string, which
  // would render "Dr. ," in the drip email.
  return tokens[0]!;
};

/**
 * Downloadable PDF of the prospect preview. Brochure cover page plus the
 * full site capture, generated with the shared puppeteer browser. Designed
 * for reps to attach directly to a follow-up email when the prospect cannot
 * or will not click a tracked link. Rate-limited because each render fires
 * a fresh Chromium page; ten requests per lead per hour is plenty.
 */
router.get(
  "/dashboard/leads/:id/portal/pdf",
  rateLimit({ name: "portal_pdf", capacity: 10, refillPerSecond: 0.05 }),
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    await loadOwnedLead(leadId, req.user!);
    const { pdf, filename } = await renderLeadPreviewPdf(leadId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.end(pdf);
  }),
);

/**
 * Downloadable MP4 walkthrough of the prospect preview. 30-second auto-pan
 * over a full-page screenshot with 5 bilingual caption cards burned in via
 * ffmpeg drawtext. Mobile + email friendly: 1280x720, H.264 baseline,
 * yuv420p, faststart, typically 4-7 MB so it plays inline in iMessage and
 * fits Gmail attachment caps. Rate-limited tighter than the PDF because
 * each render runs Puppeteer + ffmpeg back-to-back.
 */
router.get(
  "/dashboard/leads/:id/portal/video",
  rateLimit({ name: "portal_video", capacity: 6, refillPerSecond: 0.02 }),
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.id);
    await loadOwnedLead(leadId, req.user!);
    const { video, filename, mime } = await renderLeadPreviewVideo(leadId);
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.end(video);
  }),
);

// PDF + video preview downloads wired 2026-05-15 - see leadPreviewPdf.ts / leadPreviewVideo.ts.
export default router;
