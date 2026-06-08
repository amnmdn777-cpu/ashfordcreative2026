import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, portalRequests, leads } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  requireAuth,
  requireOnboardingComplete,
} from "../../middleware/requireAuth";
import { conflict, notFound } from "../../lib/errors";
import { dateToIso } from "../../lib/serialize";

const router: IRouter = Router();

router.use(
  "/dashboard/portal-requests",
  requireAuth,
  requireOnboardingComplete,
);

/**
 * Sprint 1 (2026-05-22) — POST /dashboard/portal-requests
 *
 * Rep clicks "Demander un portail" on a lead detail page. Creates a
 * pending portal_requests row that surfaces on the admin dashboard.
 *
 * Guard: the rep must own the lead (claimedByRepId === me). A duplicate
 * pending request for the same lead is rejected with 409 so the founder
 * doesn't see a noisy stack of identical requests — the rep can re-ask
 * once the previous one is marked handled.
 */
const CreatePortalRequest = z.object({
  leadId: z.number().int().positive(),
  message: z.string().trim().max(2000).optional(),
});

router.post(
  "/dashboard/portal-requests",
  asyncHandler(async (req, res) => {
    const body = CreatePortalRequest.parse(req.body);

    const [lead] = await db
      .select({ id: leads.id, claimedByRepId: leads.claimedByRepId })
      .from(leads)
      .where(eq(leads.id, body.leadId))
      .limit(1);
    if (!lead) throw notFound("Lead not found.");
    if (lead.claimedByRepId !== req.user!.id) {
      throw conflict("You don't own this lead.");
    }

    // De-dupe pending requests.
    const [existing] = await db
      .select({ id: portalRequests.id })
      .from(portalRequests)
      .where(
        and(
          eq(portalRequests.leadId, body.leadId),
          eq(portalRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (existing) {
      throw conflict("A portal request is already pending for this lead.");
    }

    const [row] = await db
      .insert(portalRequests)
      .values({
        leadId: body.leadId,
        requestedByRepId: req.user!.id,
        message: body.message?.trim() || null,
      })
      .returning();

    res.json({ portalRequest: dateToIso(row) });
  }),
);

/**
 * GET /dashboard/portal-requests/mine
 *
 * The rep's own recent portal requests (any status). The lead detail
 * page uses this to render "Demande envoyée" state next to the button
 * and disable re-clicking while one is pending.
 */
router.get(
  "/dashboard/portal-requests/mine",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(portalRequests)
      .where(eq(portalRequests.requestedByRepId, req.user!.id))
      .orderBy(desc(portalRequests.createdAt))
      .limit(100);
    res.json({ portalRequests: dateToIso(rows) });
  }),
);

export default router;
