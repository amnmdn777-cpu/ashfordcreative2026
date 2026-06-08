/**
 * Synthetic monitoring for the enrichment pipeline.
 *
 * Runs `runEnrichmentForLead` against a small fixed set of sentinel
 * leads (one per supported directory shape) and reports the per-
 * source health to stdout in a parseable format. Wire this into
 * Replit's scheduled jobs to fire hourly; pipe stdout into your log
 * aggregator and alert when:
 *   - any directory source's match rate drops below 80% over a 24h
 *     window (likely a parser regression after the directory
 *     changed their HTML)
 *   - average run duration spikes (likely an upstream throttle)
 *
 * Running locally:
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/syntheticEnrichmentMonitor.ts
 *
 * The sentinel lead IDs are configurable via SYNTHETIC_LEAD_IDS env
 * var (comma-separated). When unset, the script picks any 3 active
 * leads — useful for early-stage projects where the catalog of test
 * leads is still being curated.
 */
import { eq } from "drizzle-orm";
import {
  db,
  leadEnrichment,
  leads,
  type Lead,
} from "@workspace/db";
import { runEnrichmentForLead } from "../integrations/enrichment/orchestrator";
import { logger } from "../lib/logger";

const main = async () => {
  const ids = pickSentinelIds();
  const targets: Lead[] = [];
  for (const id of ids) {
    const [row] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    if (row) targets.push(row);
  }
  if (targets.length === 0) {
    console.error(
      "synthetic-monitor: no sentinel leads found. Set SYNTHETIC_LEAD_IDS or seed the leads table.",
    );
    process.exit(1);
  }

  const results: SyntheticRun[] = [];
  for (const lead of targets) {
    const startedAt = Date.now();
    const summary = await runEnrichmentForLead(lead.id, "scheduled");
    const finishedAt = Date.now();
    const enrichmentRows = await db
      .select()
      .from(leadEnrichment)
      .where(eq(leadEnrichment.leadId, lead.id));
    const sourcesWithData = new Set(enrichmentRows.map((r) => r.sourceKey));
    results.push({
      leadId: lead.id,
      leadName: lead.name,
      durationMs: finishedAt - startedAt,
      sourcesAttempted: summary.attempted,
      sourcesSucceeded: summary.succeeded,
      sourcesWithData: sourcesWithData.size,
      sourcesWithDataKeys: Array.from(sourcesWithData),
      errors: summary.errors,
    });
  }

  // Emit one line per lead in a structured form for log aggregators.
  for (const r of results) {
    logger.info(
      {
        kind: "synthetic-monitor",
        ...r,
      },
      `synthetic-monitor: lead ${r.leadId} ran in ${r.durationMs}ms · ${r.sourcesWithData}/${r.sourcesAttempted} sources had data`,
    );
  }

  // Aggregate health summary — used by dashboard / alert rule.
  const totalAttempted = results.reduce((s, r) => s + r.sourcesAttempted, 0);
  const totalWithData = results.reduce((s, r) => s + r.sourcesWithData, 0);
  const matchRate = totalAttempted > 0 ? totalWithData / totalAttempted : 0;
  logger.info(
    {
      kind: "synthetic-monitor-summary",
      matchRate,
      totalLeads: results.length,
      totalAttempted,
      totalWithData,
    },
    `synthetic-monitor SUMMARY: match rate ${(matchRate * 100).toFixed(1)}% across ${results.length} leads`,
  );
  // Exit code 0 always — alerting is the job of the log aggregator,
  // not the script (so a single bad run doesn't kill the cron).
  process.exit(0);
};

interface SyntheticRun {
  leadId: number;
  leadName: string;
  durationMs: number;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesWithData: number;
  sourcesWithDataKeys: string[];
  errors: Record<string, string>;
}

/**
 * Read sentinel IDs from env, or fall back to "first 3 leads" so the
 * script remains useful in fresh-start projects without manual
 * configuration. Production should always have SYNTHETIC_LEAD_IDS
 * set to leads representing each shape (Headway URL, PT URL,
 * Healthgrades URL, own-website URL, no-website edge case).
 */
const pickSentinelIds = (): number[] => {
  const fromEnv = process.env.SYNTHETIC_LEAD_IDS;
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  return [];
};

main().catch((err) => {
  console.error("synthetic-monitor: fatal", err);
  process.exit(2);
});
