import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, contactRequests } from "@workspace/db";
import { eq, and, sql, desc, or, isNull } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  requireAuth,
  requireOnboardingComplete,
} from "../../middleware/requireAuth";
import { conflict, notFound } from "../../lib/errors";
import { dateToIso } from "../../lib/serialize";

const router: IRouter = Router();

router.use("/dashboard/contact-requests", requireAuth, requireOnboardingComplete);

// Open queue: not yet claimed.
router.get(
  "/dashboard/contact-requests/queue",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.status, "open"),
          isNull(contactRequests.claimedByRepId),
        ),
      )
      .orderBy(desc(contactRequests.createdAt))
      .limit(50);
    res.json({ contactRequests: dateToIso(rows) });
  }),
);

// Mine: claimed by this rep and still open/converted (not closed).
router.get(
  "/dashboard/contact-requests/mine",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.claimedByRepId, req.user!.id),
          or(
            eq(contactRequests.status, "claimed"),
            eq(contactRequests.status, "converted"),
          ),
        ),
      )
      .orderBy(desc(contactRequests.createdAt));
    res.json({ contactRequests: dateToIso(rows) });
  }),
);

// Claim — atomic.
router.post(
  "/dashboard/contact-requests/:id/claim",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const result = await db
      .update(contactRequests)
      .set({ claimedByRepId: req.user!.id, status: "claimed" })
      .where(
        and(
          eq(contactRequests.id, id),
          eq(contactRequests.status, "open"),
          isNull(contactRequests.claimedByRepId),
        ),
      )
      .returning();
    if (result.length === 0) {
      // Determine why.
      const [existing] = await db
        .select()
        .from(contactRequests)
        .where(eq(contactRequests.id, id))
        .limit(1);
      if (!existing) throw notFound("Contact request not found.");
      throw conflict(
        `Already claimed by another rep (status=${existing.status}).`,
      );
    }
    res.json({ contactRequest: dateToIso(result[0]) });
  }),
);

const PatchContactRequest = z.object({
  status: z.enum(["claimed", "converted", "closed"]).optional(),
  internalNote: z.string().max(2000).optional(),
});

router.patch(
  "/dashboard/contact-requests/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = PatchContactRequest.parse(req.body);
    const [existing] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, id))
      .limit(1);
    if (!existing) throw notFound("Contact request not found.");
    if (existing.claimedByRepId !== req.user!.id) {
      throw conflict("You don't own this contact request.");
    }
    const patch: Record<string, unknown> = {};
    if (body.status) patch.status = body.status;
    if (body.internalNote !== undefined) patch.internalNote = body.internalNote;
    const [updated] = await db
      .update(contactRequests)
      .set(patch)
      .where(eq(contactRequests.id, id))
      .returning();
    res.json({ contactRequest: dateToIso(updated) });
  }),
);

// Convenience: count for the bell.
router.get(
  "/dashboard/contact-requests/queue/count",
  asyncHandler(async (_req, res) => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.status, "open"),
          isNull(contactRequests.claimedByRepId),
        ),
      );
    res.json({ openCount: count });
  }),
);

export default router;
