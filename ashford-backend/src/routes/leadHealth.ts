import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAuth";
import { requireAuth } from "../middleware/requireAuth";

// 2026-05-21 — `lead_anomalies` table was lost during Sprint 2 cleanup.
// The route still returns enrichment-state + completeness-score buckets
// so the admin Lead Health card keeps rendering; anomalies fields are
// emptied until the anomaly engine is rebuilt.

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const stateRows = await db.execute(sql`
      SELECT enrichment_state, COUNT(*) as cnt
      FROM leads
      GROUP BY enrichment_state
      ORDER BY cnt DESC
    `);
    const scoreBuckets = await db.execute(sql`
      SELECT
        CASE
          WHEN completeness_score >= 80 THEN 'excellent'
          WHEN completeness_score >= 60 THEN 'good'
          WHEN completeness_score >= 40 THEN 'fair'
          ELSE 'poor'
        END as bucket,
        COUNT(*) as cnt
      FROM leads
      GROUP BY bucket
      ORDER BY cnt DESC
    `);
    const totalRow = await db.execute(sql`
      SELECT COUNT(*) as total, ROUND(AVG(completeness_score), 1) as avg_score FROM leads
    `);
    const readyRow = await db.execute(sql`
      SELECT COUNT(*) as ready FROM leads WHERE enrichment_state = 'ready'
    `);
    const pendingRow = await db.execute(sql`
      SELECT COUNT(*) as pending FROM leads WHERE enrichment_state = 'pending'
    `);
    const quarantinedRow = await db.execute(sql`
      SELECT COUNT(*) as quarantined FROM leads WHERE enrichment_state LIKE 'quarantine%'
    `);
    res.json({
      totals: {
        total: totalRow.rows[0]?.total ?? 0,
        ready: readyRow.rows[0]?.ready ?? 0,
        pending: pendingRow.rows[0]?.pending ?? 0,
        quarantined: quarantinedRow.rows[0]?.quarantined ?? 0,
        avg_score: totalRow.rows[0]?.avg_score ?? 0,
      },
      stateDistribution: stateRows.rows,
      scoreBuckets: scoreBuckets.rows,
      openAnomaliesByKind: [],
      recentAnomalies: [],
    });
  } catch (err: any) {
    console.error("/api/admin/lead-health error:", err.message, err.stack);
    res.status(500).json({ error: err.message ?? "Failed to fetch lead health stats" });
  }
});

export default router;
