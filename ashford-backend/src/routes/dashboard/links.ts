import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, prospectLinks } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  requireAuth,
  requireOnboardingComplete,
} from "../../middleware/requireAuth";
import { notFound, forbidden } from "../../lib/errors";
import { getLinkEvents } from "../../services/prospectLinks";
import { dateToIso } from "../../lib/serialize";

const router: IRouter = Router();
router.use("/dashboard/links", requireAuth, requireOnboardingComplete);

router.get(
  "/dashboard/links",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(prospectLinks)
      .where(eq(prospectLinks.repId, req.user!.id))
      .orderBy(desc(prospectLinks.createdAt))
      .limit(100);
    res.json({ links: dateToIso(rows) });
  }),
);

router.get(
  "/dashboard/links/:id/events",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const [link] = await db
      .select()
      .from(prospectLinks)
      .where(and(eq(prospectLinks.id, id), eq(prospectLinks.repId, req.user!.id)))
      .limit(1);
    if (!link) {
      // Could be wrong owner or doesn't exist; either way return 404 to avoid leaking.
      const [exists] = await db
        .select({ id: prospectLinks.id })
        .from(prospectLinks)
        .where(eq(prospectLinks.id, id))
        .limit(1);
      if (exists) throw forbidden("You don't own this preview link.");
      throw notFound("Preview link not found.");
    }
    const events = await getLinkEvents(id);
    res.json({ link: dateToIso(link), events: dateToIso(events) });
  }),
);

export default router;
