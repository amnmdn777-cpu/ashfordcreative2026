import { Router, type IRouter } from "express";
import { db, funnelEvents } from "@workspace/db";
import { FunnelEventRequest } from "@workspace/api-zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { rateLimit } from "../../middleware/rateLimit";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

/** Hard cap on the request body size after JSON.stringify. 8 KB is plenty
 *  for 32 funnel events × ~250 bytes — anything larger is almost certainly
 *  abuse, and we'd rather drop a noisy outlier than write-amp the table. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Append-only public funnel-event sink. Used by the self-serve template
 * flow on `ashford-site` (`lib/funnel.ts`) to record per-visitor journey
 * signals (template view, palette pick, addon toggle, reserve open/submit,
 * domain claim, checkout start).
 *
 * Wire contract: accepts either a single `{sessionId, event, ...}` payload
 * (legacy / sendBeacon) OR a batched `{sessionId, events:[...]}` payload
 * (preferred for clients buffering multiple events before send). Both
 * normalize to the same insert path.
 *
 * Hot path notes:
 *   - Insert-only — no UPDATE / DELETE. Old rows are pruned by the admin
 *     report's date filter, not by a background job.
 *   - Rate-limited per source IP (60/min, 1/s refill) so a runaway client
 *     loop can't spam the table. With batch=32, this caps writes at
 *     ~1900 rows/min/IP — more than any real user produces.
 *   - Body capped at 8 KB to limit write amp from a malicious client.
 *   - Failures are swallowed with a 204 — analytics MUST NEVER block the
 *     prospect's UI. The funnel is an observability tool, not a sale gate.
 */
router.post(
  "/public/funnel-events",
  rateLimit({ name: "funnel_event", capacity: 60, refillPerSecond: 1 }),
  asyncHandler(async (req, res) => {
    try {
      // Cheap pre-parse size check so malformed-but-huge payloads can't
      // burn JSON.parse cycles in the route. Approximate via JSON re-stringify
      // when express has already deserialized.
      const approxBytes = JSON.stringify(req.body ?? {}).length;
      if (approxBytes > MAX_BODY_BYTES) {
        logger.warn(
          { approxBytes },
          "funnel-events: payload over size cap, dropping",
        );
        res.status(204).end();
        return;
      }
      const body = FunnelEventRequest.parse(req.body);
      const sessionId = body.sessionId.slice(0, 64);
      // Normalize both legacy single + batched shapes into one row list.
      const items =
        "events" in body
          ? body.events
          : [{ event: body.event, slug: body.slug, payload: body.payload }];
      await db.insert(funnelEvents).values(
        items.map((it) => ({
          sessionId,
          event: it.event,
          slug: it.slug?.slice(0, 64),
          payload: it.payload,
        })),
      );
    } catch (err) {
      // Don't surface the error to the client — analytics is best-effort.
      // Log so we still notice if the funnel sink is broken in production.
      logger.warn(
        { err, body: req.body },
        "funnel-events: ingest failed (silently dropped)",
      );
    }
    // 204 always: success or silently-dropped — same wire effect.
    res.status(204).end();
  }),
);

export default router;
