/**
 * Manually trigger the enrichment orchestrator for a single lead.
 *
 * Usage on Replit:
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/runEnrichment.ts <leadId>
 *
 * Or by name:
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/runEnrichment.ts --name "Tara Langston"
 *
 * Use this when:
 *   - inspectEnrichment shows 0 rows (the lead was never enriched, or the
 *     enrichment table was cleared / migrated)
 *   - you've changed an enrichment source and want to refresh one lead
 *     before rolling out the change broadly
 *   - the auto-enrich on lead-creation soft-failed (no enrich row at all)
 *
 * Logs each source attempt with its outcome so you see in real time
 * which scrapers returned data, which soft-failed, and which threw.
 */
import { db, leads } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { runEnrichmentForLead } from "../integrations/enrichment/orchestrator";

const arg = process.argv[2];
const nameArg = process.argv[2] === "--name" ? process.argv[3] : null;

const main = async () => {
  let lead: typeof leads.$inferSelect | null = null;

  if (nameArg) {
    const [row] = await db
      .select()
      .from(leads)
      .where(ilike(leads.name, `%${nameArg}%`))
      .limit(1);
    lead = row ?? null;
  } else if (arg && /^\d+$/.test(arg)) {
    const [row] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, Number(arg)))
      .limit(1);
    lead = row ?? null;
  } else {
    console.error(
      "Usage: runEnrichment.ts <leadId>\n   or  runEnrichment.ts --name '<name>'",
    );
    process.exit(1);
  }

  if (!lead) {
    console.error("Lead not found.");
    process.exit(1);
  }

  console.log(
    `Triggering enrichment for lead #${lead.id} — ${lead.name} (${lead.practice}, ${lead.city}, ${lead.state})`,
  );
  console.log(`currentWebsite: ${lead.currentWebsite ?? "(none)"}`);
  console.log("");

  const result = await runEnrichmentForLead(lead.id, "manual");

  console.log("=== RUN SUMMARY ===");
  console.log({
    attempted: result.attempted,
    succeeded: result.succeeded,
    failed: result.failed,
  });
  if (Object.keys(result.errors).length > 0) {
    console.log("");
    console.log("=== ERRORS ===");
    for (const [src, msg] of Object.entries(result.errors)) {
      console.log(`  ✗ ${src}: ${msg}`);
    }
  }

  console.log("");
  console.log(
    "Run inspectEnrichment.ts again to see what each source returned.",
  );
  process.exit(0);
};

main().catch((err) => {
  console.error("Enrichment trigger failed:", err);
  process.exit(1);
});
