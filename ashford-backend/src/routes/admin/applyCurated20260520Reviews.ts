import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { logger } from "../../lib/logger";
import { PART3_SQL } from "../../migrations/curatedReviews20260520.gen";

const router: IRouter = Router();

router.use(
  "/admin/apply-curated-2026-05-20-reviews",
  requireAuth,
  requireAdmin,
);

router.post(
  "/admin/apply-curated-2026-05-20-reviews",
  asyncHandler(async (_req, res) => {
    const client = await pool.connect();
    const result: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
    };
    try {
      logger.info("apply-curated-2026-05-20-reviews: running PART 3");
      await client.query(PART3_SQL);
      result.part3 = "ok";

      const verify = await client.query(`
        SELECT l.id, l.name,
          jsonb_array_length(e.payload->'sampleReviews') AS n_sample
        FROM leads l
        LEFT JOIN lead_enrichment e
          ON e.lead_id = l.id AND e.source_key = 'manual_curated'
        WHERE l.id IN (300,469,474,476,502,504,520,521,522,530,538,541,545,555,566,569,573)
        ORDER BY array_position(ARRAY[300,469,474,476,502,504,520,521,522,530,538,541,545,555,566,569,573]::int[], l.id);
      `);
      result.rows = verify.rows;
      result.finishedAt = new Date().toISOString();
      logger.info(
        { rowCount: verify.rowCount },
        "apply-curated-2026-05-20-reviews: done",
      );
      res.json(result);
    } catch (err) {
      logger.error({ err }, "apply-curated-2026-05-20-reviews: failed");
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore — nothing to rollback or already rolled back
      }
      result.error = err instanceof Error ? err.message : String(err);
      res.status(500).json(result);
    } finally {
      client.release();
    }
  }),
);

export default router;
