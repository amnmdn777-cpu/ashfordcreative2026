import { Router, type IRouter } from "express";
import {
  captureTemplateScreenshot,
  isAllowedTemplateSlug,
} from "../../services/templateScreenshot";

const router: IRouter = Router();

/**
 * Public, unauthenticated endpoint that serves the cached template
 * screenshot. Embedded in outbound preview emails as the hero image AND
 * in the marketing-site homepage "Five looks" teaser cards.
 *
 * Auth is intentionally skipped — Gmail/Apple Mail/Outlook fetch the URL
 * with no cookies. The slug allowlist in `templateScreenshot.ts` keeps
 * this from being abused as an open screenshot service.
 *
 * Headers (#185 follow-up — homepage cards rendered as broken alt-text
 * in the workspace preview iframe):
 *
 *   • `Cross-Origin-Resource-Policy: cross-origin` — without this, the
 *     image is silently blocked when ashford-site is iframed under a
 *     parent that sets `Cross-Origin-Embedder-Policy: require-corp`
 *     (the Replit workspace preview wrapper does). The browser swallows
 *     the request before it reaches the network tab and falls back to
 *     the alt text — which is exactly what the founder reported.
 *
 *   • `Cache-Control: public, max-age=3600, must-revalidate` — was
 *     `max-age=86400, immutable`. Immutable is correct semantically
 *     (the URL identifies a content-stable resource) but it means a
 *     once-cached broken response can't self-heal in a browser session.
 *     Dropping immutable and shortening to 1h lets a bad cache state
 *     recover on the next visit without sacrificing real-world hit rate
 *     (mail clients re-fetch per-recipient anyway, and the on-disk file
 *     cache absorbs the cost).
 */
router.get("/preview-screenshot/:slug.png", async (req, res, next) => {
  const slug = req.params.slug;
  if (!slug || !isAllowedTemplateSlug(slug)) {
    return res.status(404).type("text/plain").send("Not found");
  }
  try {
    const { buffer, cached } = await captureTemplateScreenshot(slug);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
});

export default router;
