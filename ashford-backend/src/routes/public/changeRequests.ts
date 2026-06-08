/**
 * 2026-05-21 — Post-launch self-serve change requests (Sprint 2 streamline).
 *
 *   POST /api/public/portal/:slug/change-request
 *     headers: x-portal-token (or ?t=...)
 *     body:    { body: string (1-4000 chars) }
 *     → 201   { id, status, createdAt }
 *
 * Rate-limit: 5 requests / hour / portal.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, changeRequests, prospectPortals, leads, notifications } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { rateLimit } from "../../middleware/rateLimit";
import { badRequest, notFound } from "../../lib/errors";
import { requirePortalAccess } from "../../services/portals";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const ChangeRequestBody = z.object({
  body: z
    .string()
    .min(1, "Please describe what you'd like to change.")
    .max(4000, "Keep it under 4000 characters — paste long lists in chunks."),
});

const SlugParam = z.string().regex(/^[a-z0-9-]+$/, "Invalid portal slug");

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

router.post(
  "/public/portal/:slug/change-request",
  rateLimit({
    name: "portal_change_request",
    capacity: 5,
    refillPerSecond: 5 / 3600,
  }),
  asyncHandler(async (req, res) => {
    const slug = SlugParam.parse(req.params.slug).toLowerCase();
    const portal = await requirePortalAccess(slug, extractToken(req), req);

    const { body } = ChangeRequestBody.parse(req.body);
    const trimmed = body.trim();
    if (trimmed.length === 0) throw badRequest("Change request cannot be empty.");

    const [portalRow] = await db
      .select({ id: prospectPortals.id, leadId: prospectPortals.leadId })
      .from(prospectPortals)
      .where(eq(prospectPortals.id, portal.id))
      .limit(1);
    if (!portalRow) throw notFound("Portal not found");

    const [created] = await db
      .insert(changeRequests)
      .values({
        leadId: portalRow.leadId,
        portalId: portalRow.id,
        body: trimmed,
        status: "open",
        submittedVia: "portal",
      })
      .returning();

    // Notify the rep who owns the lead (best-effort).
    try {
      const [leadRow] = await db
        .select({ repId: leads.claimedByRepId, practice: leads.practice })
        .from(leads)
        .where(eq(leads.id, portalRow.leadId))
        .limit(1);
      if (leadRow?.repId) {
        await db.insert(notifications).values({
          repId: leadRow.repId,
          type: "change_request.new",
          title: `Change request from ${leadRow.practice ?? "client"}`,
          body: trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed,
          payload: { changeRequestId: created.id, leadId: portalRow.leadId },
          linkUrl: `/leads/${portalRow.leadId}`,
        });
      }
    } catch (err) {
      logger.error(
        { err, changeRequestId: created.id },
        "change-request notification failed (non-fatal)",
      );
    }

    res.status(201).json({
      id: created.id,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    });
  }),
);

export default router;
