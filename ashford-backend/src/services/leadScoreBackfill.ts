/**
 * Boot-time backfill: re-runs `computeLeadScore` for every lead whose
 * `lead_score` column is still NULL. Why a boot task and not a one-shot
 * script? The one-shot `scripts/backfillLeadScores.ts` works fine in
 * dev, but on a freshly published production deploy the script never
 * runs — Replit's Publish flow only runs schema migrations, not data
 * scripts. The result was the rep team seeing every Available Lead
 * row render with `—` in the Score column (founder feedback 2026-05,
 * screenshot of ashfordcreative.org).
 *
 * Running it on every boot is safe because:
 *  - It's WHERE-gated to `lead_score IS NULL`, so already-scored rows
 *    are skipped immediately (the SELECT returns 0 rows once steady
 *    state is reached).
 *  - We hold a Postgres advisory lock so multi-replica deploys don't
 *    duplicate the work.
 *  - We stagger the start by 60 s so the actual server bind / health
 *    probe never competes with the catch-up scan.
 *  - Bounded concurrency (5) so we don't blow up the DB pool when
 *    thousands of leads land in one go.
 *  - All errors are caught + logged; we never crash the boot.
 *
 * NOT a substitute for inline `void computeLeadScore(leadId)` calls in
 * the orchestrator — that's the path that gives a fresh lead its score
 * within seconds of enrichment. This catch-up exists for the historical
 * pool that pre-dates the scoring service.
 */

import { db, leads } from "@workspace/db";
import { isNull, sql } from "drizzle-orm";
import { computeLeadScore } from "./leadScoring";
import { logger } from "../lib/logger";

const CONCURRENCY = 5;
const BOOT_STAGGER_MS = 60_000;
// Stable 32-bit advisory-lock key. Picked once and never recycled so
// concurrent replicas all hash to the same lock. Different from the
// catalog-sync key (see stripeCatalogSync.ts) so the two boot tasks
// can run in parallel without serialising each other.
const ADVISORY_LOCK_KEY = 824_731_902;

const runBackfillOnce = async (): Promise<void> => {
  // pg_try_advisory_lock returns false immediately when another replica
  // holds the lock, so we exit cleanly and let the holder finish.
  const lockRes = await db.execute(
    sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS got`,
  );
  // drizzle's `execute` shape varies by driver — handle both row and
  // array-of-rows so the type guard stays narrow.
  const rows = (lockRes as unknown as { rows?: { got: boolean }[] }).rows
    ?? (lockRes as unknown as { got: boolean }[]);
  const got = Array.isArray(rows) ? rows[0]?.got : false;
  if (!got) {
    logger.info(
      "lead-score-backfill: another replica holds the lock, skipping",
    );
    return;
  }
  try {
    const todo = await db
      .select({ id: leads.id })
      .from(leads)
      .where(isNull(leads.leadScore));
    if (todo.length === 0) {
      logger.info("lead-score-backfill: no unscored leads, nothing to do");
      return;
    }
    logger.info(
      { count: todo.length },
      "lead-score-backfill: starting catch-up scan",
    );
    let cursor = 0;
    let scored = 0;
    let tierA = 0;
    let tierB = 0;
    let tierC = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const idx = cursor++;
        if (idx >= todo.length) return;
        const id = todo[idx]?.id;
        if (id === undefined) continue;
        const breakdown = await computeLeadScore(id);
        if (breakdown) {
          scored++;
          if (breakdown.tier === "A") tierA++;
          else if (breakdown.tier === "B") tierB++;
          else tierC++;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    logger.info(
      { scored, total: todo.length, tierA, tierB, tierC },
      "lead-score-backfill: complete",
    );
  } finally {
    try {
      await db.execute(
        sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`,
      );
    } catch (err) {
      logger.warn(
        { err },
        "lead-score-backfill: advisory_unlock failed — lock will release on session end",
      );
    }
  }
};

/**
 * Wire-in entry point used by `index.ts`. Schedules a single delayed
 * run so we never block the Express bind. Failures are logged, never
 * thrown — same posture as `startStripeCatalogSyncScheduler`.
 */
export const startLeadScoreBackfill = (): void => {
  if (process.env["LEAD_SCORE_BACKFILL_DISABLED"] === "1") {
    logger.info(
      "lead-score-backfill: disabled via LEAD_SCORE_BACKFILL_DISABLED=1",
    );
    return;
  }
  setTimeout(() => {
    runBackfillOnce().catch((err) => {
      logger.error({ err }, "lead-score-backfill: boot run crashed");
    });
  }, BOOT_STAGGER_MS).unref();
  logger.info(
    { staggerMs: BOOT_STAGGER_MS, concurrency: CONCURRENCY },
    "lead-score-backfill scheduler armed (boot-time, advisory-lock guarded)",
  );
};
