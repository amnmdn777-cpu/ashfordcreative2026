import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { logger } from "../../lib/logger";
import { PART1_SQL, PART2_SQL } from "../../migrations/curated20260520.gen";

const router: IRouter = Router();

router.use("/admin/apply-curated-2026-05-20", requireAuth, requireAdmin);

router.post(
  "/admin/apply-curated-2026-05-20",
  asyncHandler(async (_req, res) => {
    const client = await pool.connect();
    const result: Record<string, unknown> = { startedAt: new Date().toISOString() };
    try {
      logger.info("apply-curated-2026-05-20: running PART 1");
      await client.query(PART1_SQL);
      result.part1 = "ok";

      logger.info("apply-curated-2026-05-20: running PART 2");
      await client.query(PART2_SQL);
      result.part2 = "ok";

      const verify = await client.query(`
        SELECT l.id, l.name,
          e.payload->>'addressLine1' AS street,
          e.payload->>'city' AS city,
          e.payload->>'state' AS state,
          e.payload->>'zip' AS zip,
          e.payload->>'_addressNote' AS note,
          (e.payload->>'ogImg' IS NOT NULL) AS has_photo,
          jsonb_array_length(e.payload->'specialties') AS n_spec,
          jsonb_array_length(e.payload->'modalities') AS n_modal
        FROM leads l
        LEFT JOIN lead_enrichment e ON e.lead_id = l.id AND e.source_key = 'manual_curated'
        WHERE l.id IN (300,469,474,476,502,504,520,521,522,530,538,541,545,555,566,569,573)
        ORDER BY array_position(ARRAY[300,469,474,476,502,504,520,521,522,530,538,541,545,555,566,569,573]::int[], l.id);
      `);
      result.rows = verify.rows;
      result.finishedAt = new Date().toISOString();
      logger.info({ rowCount: verify.rowCount }, "apply-curated-2026-05-20: done");
      res.json(result);
    } catch (err) {
      logger.error({ err }, "apply-curated-2026-05-20: failed");
      // Defensive: the embedded SQL files open their own BEGIN/COMMIT
      // blocks, so a mid-script failure can leave the session in an
      // aborted-transaction state. Issue a best-effort ROLLBACK before
      // returning the client to the pool so the next caller doesn't
      // inherit a poisoned session.
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
