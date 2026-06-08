import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveShortLink } from "../../services/shortLinks";
import { asyncHandler } from "../../middleware/asyncHandler";

const router: IRouter = Router();

const CodeParam = z
  .string()
  .min(4)
  .max(16)
  .regex(/^[A-Za-z0-9]+$/);

/**
 * GET /s/:code -> 302 to the original URL.
 *
 * Mounted under the `/api` prefix in this codebase, so the user-visible
 * URL is `${publicBaseUrl}/s/<code>`. We return a tiny HTML "expired"
 * page on miss instead of a bare 404 so a prospect who clicks an old link
 * has context for what to do next.
 */
router.get(
  "/s/:code",
  asyncHandler(async (req, res) => {
    const parsed = CodeParam.safeParse(req.params.code);
    if (!parsed.success) {
      res
        .status(400)
        .type("text/html")
        .send(
          "<!DOCTYPE html><html><body style=\"font-family:system-ui,sans-serif;padding:32px;max-width:520px;margin:auto;color:#1f2937;\"><h1 style=\"color:#3F6657;\">Invalid link</h1><p>That link doesn't look right. Please double-check it or ask the sender for a fresh one.</p></body></html>",
        );
      return;
    }
    const link = await resolveShortLink(parsed.data);
    if (!link) {
      res
        .status(404)
        .type("text/html")
        .send(
          "<!DOCTYPE html><html><body style=\"font-family:system-ui,sans-serif;padding:32px;max-width:520px;margin:auto;color:#1f2937;\"><h1 style=\"color:#3F6657;\">Link expired</h1><p>This preview link is no longer valid. Reply to the message or write to hello@ashfordcreative.org and we'll send you a fresh one.</p></body></html>",
        );
      return;
    }
    res.redirect(302, link.targetUrl);
  }),
);

export default router;
