/**
 * One-shot backfill: compute lead_score for every lead that doesn't yet
 * have one. Safe to re-run — the WHERE clause skips already-scored rows.
 *
 *   pnpm --filter @workspace/api-server tsx src/scripts/backfillLeadScores.ts
 *
 * Bounded concurrency (5) so we don't blow up DB connections on a fresh
 * pool of thousands of leads.
 */

import { db, leads } from "@workspace/db";
import { isNull } from "drizzle-orm";
import { computeLeadScore } from "../services/leadScoring";
import { logger } from "../lib/logger";

const CONCURRENCY = 5;

const main = async () => {
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(isNull(leads.leadScore));
  logger.info({ count: rows.length }, "backfillLeadScores: starting");
  if (rows.length === 0) return;

  let cursor = 0;
  let scored = 0;
  let tierA = 0;
  let tierB = 0;
  let tierC = 0;

  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= rows.length) return;
      const id = rows[idx].id;
      const breakdown = await computeLeadScore(id);
      if (breakdown) {
        scored++;
        if (breakdown.tier === "A") tierA++;
        else if (breakdown.tier === "B") tierB++;
        else tierC++;
      }
      if (scored > 0 && scored % 25 === 0) {
        logger.info(
          { scored, total: rows.length, tierA, tierB, tierC },
          "backfillLeadScores: progress",
        );
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  logger.info(
    { scored, total: rows.length, tierA, tierB, tierC },
    "backfillLeadScores: done",
  );
  process.exit(0);
};

main().catch((err) => {
  logger.error({ err }, "backfillLeadScores: crashed");
  process.exit(1);
});
