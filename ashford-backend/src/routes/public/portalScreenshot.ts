import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, prospectPortals } from "@workspace/db";
import { capturePortalScreenshot } from "../../services/templateScreenshot";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

/**
 * Public, token-gated endpoint that serves the cached screenshot of a
 * prospect's customized portal preview. Unlike the template-screenshot
 * route (which serves a generic per-template image), this captures the
 * actual `/preview/:slug?t=...` page — colors, logo, hero photo, and copy
 * edits the rep has made are all visible.
 *
 * Auth model: `?t=` query param must equal the portal's `accessToken`. We
 * don't gate on cookies because email clients fetch this URL with no
 * cookies attached. The token is the same one already in the CTA link,
 * scoped to a single prospect, so embedding it in `<img src>` does not
 * meaningfully widen the attack surface.
 *
 * On capture failure (network timeout, browser crash, expired portal):
 * we return 404 instead of an error PNG. Mail clients render that as a
 * missing image, and the renderer's graceful-degradation path means the
 * email body stays readable. Logging the failure (without leaking the
 * token) lets ops alert on broken capture infrastructure.
 */
router.get("/portal-screenshot/:slug.png", async (req, res) => {
  const slug = req.params.slug;
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!slug || !token) {
    return res.status(404).type("text/plain").send("Not found");
  }
  try {
    const [portal] = await db
      .select({ accessToken: prospectPortals.accessToken })
      .from(prospectPortals)
      .where(eq(prospectPortals.slug, slug))
      .limit(1);
    if (!portal || portal.accessToken !== token) {
      return res.status(404).type("text/plain").send("Not found");
    }
    const { buffer, cached } = await capturePortalScreenshot(slug, token);
    // Strong-cache headers for mail-client image proxies (Gmail, Outlook,
    // Apple Mail). The portal-screenshot URL is keyed by the per-portal
    // accessToken, so the byte payload for a given URL is stable for the
    // life of the cached PNG (1h TTL on disk). `immutable` tells the
    // proxy not to re-validate, which fixes the "broken image after first
    // open" bug some prospects hit when the proxy refetched on second
    // viewing and our cache had rotated. ETag lets well-behaved clients
    // skip the body on conditional GETs.
    const etag = `W/"${buffer.length.toString(16)}-${slug}"`;
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }
    res.setHeader("Content-Type", "image/png");
    // Day-scale cache (founder requirement #224, architect review
    // 2026-05): the URL is keyed by the per-portal accessToken so the
    // byte payload is stable for the life of the portal. A 24h TTL
    // matches the disk cache window we expect Gmail/Outlook proxies
    // to honor and removes the "broken image on second open the next
    // morning" failure mode that 1h TTL still left exposed.
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, immutable",
    );
    res.setHeader("ETag", etag);
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    return res.send(buffer);
  } catch (err) {
    // We DO NOT propagate to the global error handler (which would 500
    // and surface a broken-image icon in mail clients). Capture failures
    // are operationally normal — Chromium can OOM, the dev server can be
    // restarting, the portal slug can have been deleted between send and
    // open. Returning 404 lets the mail client treat it as a missing
    // resource; the email body remains readable. The original send-time
    // pre-flight capture is what guarantees the URL was good when we
    // shipped the email — this catch only fires when the cache file
    // expired AND the re-capture failed.
    logger.warn({ err, slug }, "portal-screenshot: capture failed");
    return res.status(404).type("text/plain").send("Not found");
  }
});

export default router;
