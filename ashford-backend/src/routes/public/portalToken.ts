import { Router, type IRouter } from "express";
import { db, prospectPortals } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";

const router: IRouter = Router();

/**
 * GET /p/:token
 * Short-form portal access by raw access token. Looks up the portal whose
 * accessToken matches, then 302-redirects to the canonical portal URL so
 * the SPA can handle the full experience. Expired portals redirect with
 * ?expired=1 so the frontend can render a friendly "link expired" screen.
 */
router.get(
  "/p/:token",
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const [portal] = await db
      .select({
        slug: prospectPortals.slug,
        lifecycleState: prospectPortals.lifecycleState,
      })
      .from(prospectPortals)
      .where(eq(prospectPortals.accessToken, token))
      .limit(1);

    if (!portal) {
      res.status(404).send("Portal not found.");
      return;
    }

    if (portal.lifecycleState === "expired") {
      res.redirect(302, `/public/portals/${portal.slug}?expired=1`);
      return;
    }

    res.redirect(302, `/public/portals/${portal.slug}`);
  }),
);

export default router;
