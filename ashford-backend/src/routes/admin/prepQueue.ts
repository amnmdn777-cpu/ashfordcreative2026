// Admin-curated portal preparation queue.
//
// Replaces the rep-side "Prepare preview" / "Briefing" auto-pipeline. When
// a rep clicks "Request preparation" on a lead, the portal flips to
// prepStatus = 'requested' and a row lands in admin_notifications. The
// admin reviews the lead here, can re-run enrichment + adjust the portal
// inline (the existing /admin/leads/:id/portal admin routes), and finally
// clicks "Mark ready" — that regenerates + stores the briefing, flips
// prepStatus to 'ready', and notifies the rep.
//
// See:
//   - lib/db/drizzle/0030_portal_prep_workflow.sql (schema)
//   - lib/db/src/schema/portals.ts (portalPrepStatusEnum + cols)
//   - artifacts/api-server/src/routes/dashboard/portals.ts (rep-side
//     POST /portal/request-prep + read-side briefing gate)
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  prospectPortals,
  leads,
  salesReps,
  adminNotifications,
  notifications,
} from "@workspace/db";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAdmin, requireAuth } from "../../middleware/requireAuth";
import { badRequest, notFound } from "../../lib/errors";
import { ensurePortalForLead, resetPortalCompletely } from "../../services/portals";
import { generateBriefing } from "../../services/briefing";
import { runEnrichmentForLead } from "../../integrations/enrichment/orchestrator";
import {
  runPortalAudit,
  applyPortalAudit,
  getLatestAudit,
  getAuditHistory,
  AUDITABLE_FIELD_KEYS,
} from "../../services/portalAudit";
import {
  sendAuditChatMessage,
  listAuditChat,
  applyAuditChatProposal,
  rejectAuditChatProposal,
} from "../../services/portalAuditChat";
import { runHarmonization } from "../../services/portalHarmonizer";
import { logger } from "../../lib/logger";
import { dateToIso } from "../../lib/serialize";

const router: IRouter = Router();
router.use("/admin/prep-queue", requireAuth, requireAdmin);

const LeadIdParam = z.coerce.number().int().positive();

/**
 * Lists every portal awaiting admin curation. Sorted by the rep's
 * inferred priority: lead score desc, then portal openCount desc (a hot
 * lead the prospect keeps reopening jumps the queue), then oldest
 * request first so nothing sits forever.
 *
 * Returns a flat row shape ready for the admin table — no client-side
 * stitching needed.
 */
router.get(
  "/admin/prep-queue",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        leadId: leads.id,
        name: leads.name,
        practice: leads.practice,
        city: leads.city,
        state: leads.state,
        currentWebsite: leads.currentWebsite,
        leadScore: leads.leadScore,
        scoreTier: sql<string>`(${leads.scoreBreakdown}->>'tier')`,
        repId: salesReps.id,
        repDisplayName: salesReps.displayName,
        portalId: prospectPortals.id,
        slug: prospectPortals.slug,
        selectedTemplate: prospectPortals.selectedTemplate,
        openCount: prospectPortals.openCount,
        lastOpenedAt: prospectPortals.lastOpenedAt,
        prepRequestedAt: prospectPortals.prepRequestedAt,
        briefingReady: sql<boolean>`${prospectPortals.briefingMd} IS NOT NULL`,
      })
      .from(prospectPortals)
      .innerJoin(leads, eq(leads.id, prospectPortals.leadId))
      .leftJoin(salesReps, eq(salesReps.id, leads.claimedByRepId))
      .where(eq(prospectPortals.prepStatus, "requested"))
      .orderBy(
        desc(leads.leadScore),
        desc(prospectPortals.openCount),
        asc(prospectPortals.prepRequestedAt),
      );
    res.json({ queue: dateToIso(rows) });
  }),
);

/**
 * Small badge count for the admin dashboard nav. Cheap query, cached
 * for 5s upstream.
 */
router.get(
  "/admin/prep-queue/count",
  asyncHandler(async (_req, res) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospectPortals)
      .where(eq(prospectPortals.prepStatus, "requested"));
    res.json({ count: row?.count ?? 0 });
  }),
);

/**
 * Admin regenerates the briefing without flipping the lifecycle. Used
 * while curating: admin wants to see what the LLM produced after they
 * edited enrichment by hand, before committing.
 */
router.post(
  "/admin/prep-queue/:leadId/briefing/regenerate",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const portal = await ensurePortalForLead(leadId);
    const briefing = await generateBriefing(leadId);
    const now = new Date();
    await db
      .update(prospectPortals)
      .set({
        briefingMd: JSON.stringify(briefing),
        briefingGeneratedAt: now,
        updatedAt: now,
      })
      .where(eq(prospectPortals.id, portal.id));
    res.json({ ok: true, briefing });
  }),
);

/**
 * The big one: mark the portal ready, notify the rep, generate+store
 * the briefing if it isn't already stored.
 *
 * Idempotent: re-running on an already-ready portal is fine (no new
 * notification fires).
 */
router.post(
  "/admin/prep-queue/:leadId/mark-ready",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) throw notFound("Lead not found");
    if (!lead.claimedByRepId) {
      throw badRequest("Lead is not currently claimed by a rep.");
    }
    const portal = await ensurePortalForLead(leadId);

    if (portal.prepStatus === "ready") {
      res.json({
        ok: true,
        prepStatus: portal.prepStatus,
        prepReadyAt: portal.prepReadyAt,
        alreadyReady: true,
      });
      return;
    }

    // Generate + store briefing if missing. Soft-fails: a briefing error
    // shouldn't block the rep from getting the portal — we'll surface the
    // error in logs and the rep just sees no briefing until admin retries.
    let briefingStored = Boolean(portal.briefingMd);
    if (!briefingStored) {
      try {
        const briefing = await generateBriefing(leadId);
        await db
          .update(prospectPortals)
          .set({
            briefingMd: JSON.stringify(briefing),
            briefingGeneratedAt: new Date(),
          })
          .where(eq(prospectPortals.id, portal.id));
        briefingStored = true;
      } catch (err) {
        logger.warn(
          { leadId, err },
          "mark-ready: briefing generation failed; releasing portal without briefing",
        );
      }
    }

    const now = new Date();
    const [updated] = await db
      .update(prospectPortals)
      .set({
        prepStatus: "ready",
        prepReadyAt: now,
        updatedAt: now,
      })
      .where(eq(prospectPortals.id, portal.id))
      .returning();

    // Notify the owning rep so the in-app bell lights up.
    await db.insert(notifications).values({
      repId: lead.claimedByRepId,
      type: "portal_prep_ready",
      title: `${lead.name} — portal ready`,
      body: `The team finished preparing the custom portal and briefing for ${lead.name} (${lead.practice}). Open the lead to review.`,
      linkUrl: `/leads/${leadId}`,
      payload: { leadId, portalSlug: updated.slug },
    });

    // Mark the originating admin_notifications row as read so it falls
    // out of the unread feed automatically.
    await db
      .update(adminNotifications)
      .set({ readAt: now })
      .where(
        and(
          eq(adminNotifications.leadId, leadId),
          eq(adminNotifications.kind, "portal_prep_requested"),
        ),
      );

    logger.info(
      {
        leadId,
        portalId: portal.id,
        briefingStored,
        notifiedRepId: lead.claimedByRepId,
      },
      "portal_marked_ready",
    );

    res.json({
      ok: true,
      prepStatus: updated.prepStatus,
      prepReadyAt: updated.prepReadyAt,
      briefingStored,
      alreadyReady: false,
    });
  }),
);

/**
 * Roll back a ready portal to requested. Useful if the admin notices
 * something stale after release and wants the rep to wait while they
 * fix it. Doesn't delete the stored briefing — the next mark-ready will
 * regenerate if briefingMd is null, otherwise reuses.
 */
router.post(
  "/admin/prep-queue/:leadId/revert",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const portal = await ensurePortalForLead(leadId);
    if (portal.prepStatus !== "ready") {
      throw badRequest(
        "Only ready portals can be reverted to requested.",
        { reason: "portal_not_ready" },
      );
    }
    const now = new Date();
    await db
      .update(prospectPortals)
      .set({
        prepStatus: "requested",
        prepRequestedAt: now,
        prepReadyAt: null,
        briefingMd: null,
        briefingGeneratedAt: null,
        updatedAt: now,
      })
      .where(eq(prospectPortals.id, portal.id));
    await db.insert(adminNotifications).values({
      kind: "portal_prep_reverted",
      leadId,
      body: "Admin reverted a ready portal back to requested for re-curation.",
    });
    res.json({ ok: true });
  }),
);

// ===========================================================================
// 2026-05-19 — Portal QA audit engine. Compares the live portal against
// every enrichment source's payload, surfaces mismatches, and lets the
// admin apply per-field fixes. See services/portalAudit.ts.
// ===========================================================================

const AUDIT_FIELD_KEY_SET = new Set(AUDITABLE_FIELD_KEYS);
const FieldKeysBody = z
  .object({
    auditId: z.coerce.number().int().positive(),
    fieldKeys: z
      .array(z.string().refine((s) => AUDIT_FIELD_KEY_SET.has(s), {
        message: "Unknown audit field key",
      }))
      .optional(),
  })
  .strict();

/**
 * Run a fresh audit for a lead's portal. Idempotent in the sense that
 * any prior open audit is marked `superseded` and the new audit becomes
 * the canonical one. The route is synchronous (the LLM call is ~10-20s)
 * so the UI shows a loading state.
 */
router.post(
  "/admin/prep-queue/:leadId/audit",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const adminId = req.user?.id;
    const result = await runPortalAudit(leadId, adminId);
    res.json(result);
  }),
);

/**
 * Batch-audit every portal currently in prep_status='requested'. Used by
 * the admin Prep Queue to triage in one shot — returns a sorted summary
 * (lowest score first, i.e. needs most work). Each audit is run sequen-
 * tially with a small concurrency budget so we don't hammer Anthropic's
 * rate limits.
 *
 * Body:
 *   { skipRecentHours?: number }  — defaults to 24. Leads with a
 *     non-superseded audit newer than this are skipped (their existing
 *     score is reused). Pass 0 to force re-audit everything.
 *
 * Response:
 *   {
 *     audited: number,      // newly audited this run
 *     skipped: number,      // reused a recent audit
 *     failed: number,
 *     totalElapsedSec: number,
 *     results: Array<{ leadId, leadName, practice, score, gaps, status, error? }>
 *   }
 *
 * Long-running (≈10s × N when nothing cached). We bump res.setTimeout
 * so reverse proxies don't kill it mid-flight.
 */
router.post(
  "/admin/prep-queue/batch-audit",
  asyncHandler(async (req, res) => {
    const Body = z
      .object({ skipRecentHours: z.coerce.number().int().min(0).max(168).optional() })
      .strict();
    const { skipRecentHours = 24 } = Body.parse(req.body ?? {});
    const adminId = req.user?.id;

    res.setTimeout(30 * 60 * 1000); // 30 min cap

    const queued = await db
      .select({
        leadId: leads.id,
        name: leads.name,
        practice: leads.practice,
      })
      .from(prospectPortals)
      .innerJoin(leads, eq(leads.id, prospectPortals.leadId))
      .where(eq(prospectPortals.prepStatus, "requested"));

    const t0 = Date.now();
    const results: Array<{
      leadId: number;
      leadName: string;
      practice: string | null;
      score: number | null;
      gaps: number;
      status: "audited" | "skipped" | "failed";
      error?: string;
    }> = [];
    let audited = 0;
    let skipped = 0;
    let failed = 0;

    const skipMs = skipRecentHours * 60 * 60 * 1000;

    for (const row of queued) {
      try {
        // Reuse a fresh recent audit when present.
        if (skipMs > 0) {
          const latest = await getLatestAudit(row.leadId);
          if (
            latest &&
            latest.createdAt &&
            Date.now() - new Date(latest.createdAt).getTime() < skipMs
          ) {
            results.push({
              leadId: row.leadId,
              leadName: row.name,
              practice: row.practice,
              score: latest.overallScore ?? null,
              gaps: latest.gapsCount ?? 0,
              status: "skipped",
            });
            skipped++;
            continue;
          }
        }

        const audit = await runPortalAudit(row.leadId, adminId);
        results.push({
          leadId: row.leadId,
          leadName: row.name,
          practice: row.practice,
          score: audit.overallScore ?? null,
          gaps: audit.gapsCount ?? 0,
          status: "audited",
        });
        audited++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          leadId: row.leadId,
          leadName: row.name,
          practice: row.practice,
          score: null,
          gaps: 0,
          status: "failed",
          error: message,
        });
        failed++;
        logger.warn({ leadId: row.leadId, err: message }, "batch_audit_failed_one");
      }
    }

    // Sort: failed last, then lowest score (most work needed) first.
    results.sort((a, b) => {
      if (a.status === "failed" && b.status !== "failed") return 1;
      if (b.status === "failed" && a.status !== "failed") return -1;
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      return sa - sb;
    });

    const totalElapsedSec = Math.round((Date.now() - t0) / 1000);
    logger.info(
      { audited, skipped, failed, totalElapsedSec },
      "batch_audit_complete",
    );

    res.json({ audited, skipped, failed, totalElapsedSec, results });
  }),
);

/**
 * Fetch the most recent audit for a lead (any status). Returns null when
 * no audit has ever been run.
 */
router.get(
  "/admin/prep-queue/:leadId/audit/latest",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const audit = await getLatestAudit(leadId);
    res.json({ audit });
  }),
);

/**
 * Last 10 audits for a lead, newest first. Used by the admin history panel.
 */
router.get(
  "/admin/prep-queue/:leadId/audit/history",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const history = await getAuditHistory(leadId);
    res.json({ history });
  }),
);
/**
 * Apply (a subset of) the recommended fixes from an audit. When body.fieldKeys
 * is omitted, every mismatched field with a recommended value is applied. The
 * lead path-param is preserved for ACL + routing symmetry.
 */
router.post(
  "/admin/prep-queue/:leadId/audit/apply",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const body = FieldKeysBody.parse(req.body ?? {});
    const adminId = req.user?.id;
    if (!adminId) {
      throw badRequest("Missing authenticated admin id");
    }
    const result = await applyPortalAudit(body.auditId, adminId, body.fieldKeys);
    logger.info(
      { leadId, auditId: body.auditId, adminId, applied: result.appliedKeys },
      "portal_audit_applied",
    );
    res.json(result);
  }),
);

// ===========================================================================
// 2026-05-19 — Audit assistant chat. See services/portalAuditChat.ts.
// ===========================================================================

const ProposalIdParam = z.coerce.number().int().positive();
const AuditIdParam = z.coerce.number().int().positive();
const ChatMessageBody = z
  .object({ content: z.string().trim().min(1).max(4000) })
  .strict();

/**
 * List every chat turn for an audit, oldest first. The UI uses this on
 * panel mount and after each send to refresh the transcript.
 */
router.get(
  "/admin/prep-queue/:leadId/audit/:auditId/chat",
  asyncHandler(async (req, res) => {
    const _leadId = LeadIdParam.parse(req.params.leadId);
    const auditId = AuditIdParam.parse(req.params.auditId);
    void _leadId;
    const turns = await listAuditChat(auditId);
    res.json({ turns });
  }),
);

/**
 * Send a user message to the audit assistant. Persists the user turn,
 * calls Claude (with tool definitions), persists the assistant turn(s)
 * + any pending proposals, and returns the new turns the UI should
 * append. Proposals are never auto-applied — the admin clicks Apply.
 */
router.post(
  "/admin/prep-queue/:leadId/audit/:auditId/chat",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const auditId = AuditIdParam.parse(req.params.auditId);
    const body = ChatMessageBody.parse(req.body ?? {});
    const adminId = req.user?.id;
    const result = await sendAuditChatMessage({
      leadId,
      auditId,
      content: body.content,
      adminId,
    });
    res.json(result);
  }),
);

/**
 * Apply a single pending proposal (lead-field, portal-customization, or
 * source-override). The service writes the change and triggers a fresh
 * audit run so the panel reflects the new score.
 */
router.post(
  "/admin/prep-queue/:leadId/audit/chat-proposal/:proposalId/apply",
  asyncHandler(async (req, res) => {
    const _leadId = LeadIdParam.parse(req.params.leadId);
    void _leadId;
    const proposalId = ProposalIdParam.parse(req.params.proposalId);
    const adminId = req.user?.id;
    if (!adminId) {
      throw badRequest("Missing authenticated admin id");
    }
    const result = await applyAuditChatProposal(proposalId, adminId);
    res.json(result);
  }),
);

/**
 * Reject a pending proposal. Flips status to 'rejected' with no
 * side-effects on the lead row or portal customizations.
 */
router.post(
  "/admin/prep-queue/:leadId/audit/chat-proposal/:proposalId/reject",
  asyncHandler(async (req, res) => {
    const _leadId = LeadIdParam.parse(req.params.leadId);
    void _leadId;
    const proposalId = ProposalIdParam.parse(req.params.proposalId);
    const adminId = req.user?.id;
    if (!adminId) {
      throw badRequest("Missing authenticated admin id");
    }
    const result = await rejectAuditChatProposal(proposalId, adminId);
    res.json(result);
  }),
);

/**
 * Wipe + re-enrich the lead so the admin can re-audit from scratch.
 * Wraps the existing `resetPortalCompletely` helper followed by a
 * synchronous enrichment run. Slow (~60s) — the UI surfaces a warning.
 */
router.post(
  "/admin/prep-queue/:leadId/regenerate",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    await resetPortalCompletely(leadId);
    const enrichment = await runEnrichmentForLead(leadId, "manual");
    logger.info(
      { leadId, enrichment, adminId: req.user?.id },
      "portal_regenerated_by_admin",
    );
    res.json({ ok: true, enrichment });
  }),
);

/**
 * 2026-05-19 — AI harmonizer: holistic design + copy + marketing review.
 * Distinct from audit (per-field); returns ordered suggestions for a
 * sellable, polished portal.
 */
router.post(
  "/admin/prep-queue/:leadId/harmonize",
  asyncHandler(async (req, res) => {
    const leadId = LeadIdParam.parse(req.params.leadId);
    const result = await runHarmonization(leadId);
    res.json(result);
  }),
);

export default router;
