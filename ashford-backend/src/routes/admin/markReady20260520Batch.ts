import { Router, type IRouter } from "express";
import {
  db,
  prospectPortals,
  leads,
  adminNotifications,
  notifications,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { logger } from "../../lib/logger";
import { ensurePortalForLead } from "../../services/portals";
import { generateBriefing } from "../../services/briefing";

const router: IRouter = Router();

const BATCH_LEAD_IDS = [
  300, 469, 474, 476, 502, 504, 520, 521, 522, 530, 538, 541, 545, 555, 566,
  569, 573,
] as const;

router.use(
  "/admin/mark-ready-2026-05-20-batch",
  requireAuth,
  requireAdmin,
);

type LeadResult = {
  leadId: number;
  status: "ok" | "skipped" | "error";
  reason?: string;
  briefingGenerated?: boolean;
  alreadyReady?: boolean;
};

// In-process job tracking. One batch at a time is plenty for a 17-lead
// one-shot — if Candice fires twice we just return the existing state.
let currentJob: {
  startedAt: string;
  finishedAt: string | null;
  total: number;
  results: LeadResult[];
} | null = null;

async function runBatch() {
  if (!currentJob) return;
  try {
  for (const leadId of BATCH_LEAD_IDS) {
      try {
        const [lead] = await db
          .select()
          .from(leads)
          .where(eq(leads.id, leadId))
          .limit(1);
        if (!lead) {
          currentJob.results.push({ leadId, status: "skipped", reason: "lead_not_found" });
          continue;
        }
        if (!lead.claimedByRepId) {
          currentJob.results.push({ leadId, status: "skipped", reason: "unclaimed" });
          continue;
        }

        const portal = await ensurePortalForLead(leadId);

        if (portal.prepStatus === "ready") {
          currentJob.results.push({ leadId, status: "ok", alreadyReady: true });
          continue;
        }

        let briefingGenerated = false;
        if (!portal.briefingMd) {
          try {
            const briefing = await Promise.race([
              generateBriefing(leadId),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("briefing_timeout_90s")),
                  90_000,
                ),
              ),
            ]);
            await db
              .update(prospectPortals)
              .set({
                briefingMd: JSON.stringify(briefing),
                briefingGeneratedAt: new Date(),
              })
              .where(eq(prospectPortals.id, portal.id));
            briefingGenerated = true;
          } catch (err) {
            logger.warn(
              { leadId, err },
              "mark-ready-batch: briefing generation failed; releasing portal without briefing",
            );
          }
        }

        const now = new Date();
        const [updated] = await db
          .update(prospectPortals)
          .set({ prepStatus: "ready", prepReadyAt: now, updatedAt: now })
          .where(eq(prospectPortals.id, portal.id))
          .returning();

        await db.insert(notifications).values({
          repId: lead.claimedByRepId,
          type: "portal_prep_ready",
          title: `${lead.name} — portal ready`,
          body: `The team finished preparing the custom portal and briefing for ${lead.name} (${lead.practice}). Open the lead to review.`,
          linkUrl: `/leads/${leadId}`,
          payload: { leadId, portalSlug: updated.slug },
        });

        await db
          .update(adminNotifications)
          .set({ readAt: now })
          .where(
            and(
              eq(adminNotifications.leadId, leadId),
              eq(adminNotifications.kind, "portal_prep_requested"),
            ),
          );

        currentJob.results.push({
          leadId,
          status: "ok",
          briefingGenerated,
          alreadyReady: false,
        });
      } catch (err) {
        logger.error({ leadId, err }, "mark-ready-batch: lead failed");
        currentJob.results.push({
          leadId,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
      logger.info(
        { leadId, progress: `${currentJob.results.length}/${BATCH_LEAD_IDS.length}` },
        "mark-ready-batch: lead done",
      );
    }
  } finally {
    // Always set finishedAt, even if the loop throws unexpectedly, so a
    // future POST is never permanently blocked by the already_running guard.
    if (currentJob && !currentJob.finishedAt) {
      currentJob.finishedAt = new Date().toISOString();
      logger.info(
        {
          startedAt: currentJob.startedAt,
          finishedAt: currentJob.finishedAt,
          total: currentJob.total,
          ok: currentJob.results.filter((r) => r.status === "ok").length,
          skipped: currentJob.results.filter((r) => r.status === "skipped").length,
          errors: currentJob.results.filter((r) => r.status === "error").length,
        },
        "mark-ready-batch: done",
      );
    }
  }
}

function jobSummary() {
  if (!currentJob) return { state: "idle" as const };
  return {
    state: currentJob.finishedAt ? ("done" as const) : ("running" as const),
    startedAt: currentJob.startedAt,
    finishedAt: currentJob.finishedAt,
    total: currentJob.total,
    processed: currentJob.results.length,
    ok: currentJob.results.filter((r) => r.status === "ok").length,
    skipped: currentJob.results.filter((r) => r.status === "skipped").length,
    errors: currentJob.results.filter((r) => r.status === "error").length,
    results: currentJob.results,
  };
}

router.post(
  "/admin/mark-ready-2026-05-20-batch",
  asyncHandler(async (_req, res) => {
    if (currentJob && !currentJob.finishedAt) {
      res.status(202).json({
        accepted: false,
        reason: "already_running",
        ...jobSummary(),
      });
      return;
    }
    currentJob = {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      total: BATCH_LEAD_IDS.length,
      results: [],
    };
    // Fire and forget. Errors are caught inside runBatch per-lead.
    runBatch().catch((err) =>
      logger.error({ err }, "mark-ready-batch: top-level crash"),
    );
    res.status(202).json({
      accepted: true,
      message:
        "Batch started in background. Poll GET /api/admin/mark-ready-2026-05-20-batch/status for progress.",
      ...jobSummary(),
    });
  }),
);

// Note: the router.use(...) at the top of this file mounts requireAuth +
// requireAdmin on the `/admin/mark-ready-2026-05-20-batch` prefix, which
// also covers the `/status` subpath below.
router.get(
  "/admin/mark-ready-2026-05-20-batch/status",
  asyncHandler(async (_req, res) => {
    res.json(jobSummary());
  }),
);

// One-shot retry: regenerate briefings for the 4 leads that landed in
// `ready` without a briefing due to transient Postgres auth timeouts during
// the initial 2026-05-20 batch. Does not touch prep_status.
const RETRY_BRIEFING_LEAD_IDS = [300, 520, 545, 569] as const;

let retryJob: {
  startedAt: string;
  finishedAt: string | null;
  total: number;
  results: LeadResult[];
} | null = null;

async function runRetry() {
  if (!retryJob) return;
  try {
    for (const leadId of RETRY_BRIEFING_LEAD_IDS) {
      try {
        const [portal] = await db
          .select()
          .from(prospectPortals)
          .where(eq(prospectPortals.leadId, leadId))
          .limit(1);
        if (!portal) {
          retryJob.results.push({ leadId, status: "skipped", reason: "portal_not_found" });
          continue;
        }
        if (portal.briefingMd) {
          retryJob.results.push({ leadId, status: "skipped", reason: "already_has_briefing" });
          continue;
        }
        const briefing = await Promise.race([
          generateBriefing(leadId),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("briefing_timeout_120s")), 120_000),
          ),
        ]);
        await db
          .update(prospectPortals)
          .set({
            briefingMd: JSON.stringify(briefing),
            briefingGeneratedAt: new Date(),
          })
          .where(eq(prospectPortals.id, portal.id));
        retryJob.results.push({ leadId, status: "ok", briefingGenerated: true });
      } catch (err) {
        logger.error({ leadId, err }, "retry-briefings: lead failed");
        retryJob.results.push({
          leadId,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
      logger.info(
        { leadId, progress: `${retryJob.results.length}/${RETRY_BRIEFING_LEAD_IDS.length}` },
        "retry-briefings: lead done",
      );
    }
  } finally {
    if (retryJob && !retryJob.finishedAt) {
      retryJob.finishedAt = new Date().toISOString();
      logger.info(
        {
          startedAt: retryJob.startedAt,
          finishedAt: retryJob.finishedAt,
          total: retryJob.total,
          ok: retryJob.results.filter((r) => r.status === "ok").length,
          skipped: retryJob.results.filter((r) => r.status === "skipped").length,
          errors: retryJob.results.filter((r) => r.status === "error").length,
        },
        "retry-briefings: done",
      );
    }
  }
}

function retrySummary() {
  if (!retryJob) return { state: "idle" as const };
  return {
    state: retryJob.finishedAt ? ("done" as const) : ("running" as const),
    startedAt: retryJob.startedAt,
    finishedAt: retryJob.finishedAt,
    total: retryJob.total,
    processed: retryJob.results.length,
    ok: retryJob.results.filter((r) => r.status === "ok").length,
    skipped: retryJob.results.filter((r) => r.status === "skipped").length,
    errors: retryJob.results.filter((r) => r.status === "error").length,
    results: retryJob.results,
  };
}

router.use(
  "/admin/retry-briefings-2026-05-20",
  requireAuth,
  requireAdmin,
);

router.post(
  "/admin/retry-briefings-2026-05-20",
  asyncHandler(async (_req, res) => {
    if (retryJob && !retryJob.finishedAt) {
      res.status(202).json({ accepted: false, reason: "already_running", ...retrySummary() });
      return;
    }
    retryJob = {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      total: RETRY_BRIEFING_LEAD_IDS.length,
      results: [],
    };
    runRetry().catch((err) =>
      logger.error({ err }, "retry-briefings: top-level crash"),
    );
    res.status(202).json({
      accepted: true,
      message:
        "Retry started in background. Poll GET /api/admin/retry-briefings-2026-05-20/status for progress.",
      ...retrySummary(),
    });
  }),
);

router.get(
  "/admin/retry-briefings-2026-05-20/status",
  asyncHandler(async (_req, res) => {
    res.json(retrySummary());
  }),
);

export default router;
