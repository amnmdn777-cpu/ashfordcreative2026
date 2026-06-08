import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, whatsappClicks } from "@workspace/db";
import { asyncHandler } from "../../middleware/asyncHandler";
import { rateLimit } from "../../middleware/rateLimit";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

/**
 * Public WhatsApp click sink.
 *
 *   POST /public/whatsapp/click  → 204
 *     Append-only log of every click on the site's floating "Chat on
 *     WhatsApp" pill (which hands the visitor off to wa.me/<Candice's
 *     personal number>). Best-effort: never blocks the redirect to
 *     wa.me. Captures template + page + locale + opaque session id so
 *     the admin dashboard can correlate "where did this lead come
 *     from?" with the click log even though the actual conversation
 *     happens on Candice's personal phone.
 *
 * No write to the table is ever surfaced as an error to the caller —
 * if the DB is down the visitor still reaches WhatsApp, which is the
 * only thing that matters at click-time. No owner email/SMS fan-out
 * either — the founder reviews clicks in the admin dashboard.
 */

const ClickBody = z.object({
  sessionId: z.string().max(64).optional(),
  templateKey: z.string().max(64).optional(),
  pagePath: z.string().max(256).optional(),
  referrer: z.string().max(512).optional(),
  locale: z.enum(["en", "es"]).optional(),
  leadId: z.number().int().positive().optional(),
  note: z.string().max(2048).optional(),
});

router.post(
  "/public/whatsapp/click",
  rateLimit({ name: "whatsapp_click", capacity: 30, refillPerSecond: 1 }),
  asyncHandler(async (req, res) => {
    let parsed: z.infer<typeof ClickBody> = {};
    try {
      parsed = ClickBody.parse(req.body ?? {});
    } catch (err) {
      // Silently downgrade to an empty payload — we'd still rather log
      // *something* (with the UA + IP) than drop the row entirely.
      logger.debug({ err, body: req.body }, "whatsapp-click: payload invalid");
    }

    // Best-effort UA + IP capture. Trust proxy is configured in
    // `app.ts` so `req.ip` is the client, not the load balancer.
    const userAgent = (req.headers["user-agent"] ?? "")
      .toString()
      .slice(0, 512);
    const ipAddress = (req.ip ?? "").slice(0, 64);

    try {
      await db.insert(whatsappClicks).values({
        sessionId: parsed.sessionId?.slice(0, 64),
        templateKey: parsed.templateKey?.slice(0, 64),
        pagePath: parsed.pagePath?.slice(0, 256),
        referrer: parsed.referrer?.slice(0, 512),
        locale: parsed.locale,
        leadId: parsed.leadId,
        userAgent: userAgent || undefined,
        ipAddress: ipAddress || undefined,
        note: parsed.note?.slice(0, 2048),
      });
    } catch (err) {
      logger.warn({ err }, "whatsapp-click: insert failed (silently dropped)");
    }

    res.status(204).end();
  }),
);

export default router;
