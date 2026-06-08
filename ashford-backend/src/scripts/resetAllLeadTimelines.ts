/**
 * One-shot reset of every per-lead timeline artefact.
 *
 * Founder request 2026-05-08: wipe the activity history of ALL leads so the
 * pre-launch demo data doesn't pollute the timeline. Lead records themselves
 * (contact info, enrichment, portal slug + customizations) are preserved —
 * only the chronological event tables are truncated.
 *
 * Tables cleared (per-lead activity):
 *  - portal_events           (open/scroll/cart/section views)
 *  - portal_carts            (in-portal cart state)
 *  - addon_interest_signals  (add-on hover/click telemetry)
 *  - calls + call_transcripts + call_summaries
 *  - twilio_messages + email_messages
 *  - direct_messages         (rep <-> prospect chat)
 *  - callback_schedules      (scheduled callbacks)
 *  - funnel_events           (analytics breadcrumbs)
 *  - notifications           (user-facing inbox items)
 *
 * NOT touched: leads, lead_enrichment, prospect_portals (so the slug + photo
 * policy survive the wipe), addon_catalog, sales_reps.
 *
 * Run:   pnpm --filter @workspace/api-server tsx src/scripts/resetAllLeadTimelines.ts
 */
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";

const TABLES: readonly string[] = [
  "portal_events",
  "portal_carts",
  "addon_interest_signals",
  "call_summaries",
  "call_transcripts",
  "calls",
  "twilio_messages",
  "email_messages",
  "direct_messages",
  "callback_schedules",
  "funnel_events",
  "notifications",
];

async function main(): Promise<void> {
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    // RESTART IDENTITY keeps autoincrement IDs sane after the wipe.
    // CASCADE in case a future FK references one of these from another
    // timeline-y table we forget to list here.
    const before = await db.execute(
      sql.raw(`SELECT COUNT(*)::int AS n FROM ${t}`),
    );
    const n = (before.rows?.[0] as { n?: number })?.n ?? 0;
    counts[t] = n;
    if (n === 0) continue;
    await db.execute(sql.raw(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`));
  }
  // eslint-disable-next-line no-console
  console.log("[reset-timelines] cleared:", counts);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[reset-timelines] failed:", err);
  process.exit(1);
});
