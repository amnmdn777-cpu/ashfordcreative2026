import { db, leadEnrichment, enrichmentRuns, leads } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { computeLeadScore } from "../../services/leadScoring";
import { googlePlacesSource } from "./googlePlaces";
import { npiRegistrySource } from "./npiRegistry";
import { websiteScrapingSource } from "./websiteScraping";
import { currentWebsitePagesSource } from "./currentWebsitePages";
import { psychologyTodaySource } from "./psychologyToday";
import { yelpFusionSource } from "./yelp";
import { headwaySource } from "./headway";
import { linkedinApifySource } from "./linkedinApify";
import { clearbitAutocompleteSource } from "./clearbit";
import { hunterIoSource } from "./hunterIo";
import { similarwebSource } from "./similarweb";
import { texasBhecSource } from "./texasBhec";
import { healthgradesSource } from "./healthgrades";
import { websiteContentApifySource } from "./websiteContentApify";
import { zencareSource } from "./zencare";
import { almaSource } from "./alma";
import { growTherapySource } from "./growTherapy";
import { practitionerPhotosSource } from "./practitionerPhotos";
import { therapyDenSource } from "./therapyDen";
import { aiSynthesisSource } from "./aiSynthesis";
import { aiDesignAuditSource } from "./aiDesignAudit";
import { sql } from "drizzle-orm";
import type {
  Candidate,
  EnrichmentSource,
  FetchResult,
  LeadInput,
} from "./types";
import { isRejected } from "./types";

/**
 * Registered enrichment sources. Each source is a small, single-responsibility
 * adapter that soft-fails to null when its API key is missing or the upstream
 * returns nothing. The orchestrator runs them in parallel via Promise.allSettled
 * — a thrown adapter is contained, but returning null is preferred so run
 * statistics stay clean.
 *
 * Sources split into two phases:
 * - PRIMARY: hit upstream APIs in parallel. Persisted before phase 2.
 * - SYNTHESIS: depend on the latest payloads of every primary source (e.g.
 *   the AI synthesis layer reads everything else and produces a normalized
 *   profile). Runs sequentially after primary completes.
 *
 * To add a new source: implement EnrichmentSource in a new file under this
 * directory and append the singleton instance here.
 */
const PRIMARY_SOURCES: EnrichmentSource[] = [
  googlePlacesSource,
  npiRegistrySource,
  websiteScrapingSource,
  currentWebsitePagesSource,
  websiteContentApifySource,
  psychologyTodaySource,
  yelpFusionSource,
  headwaySource,
  linkedinApifySource,
  clearbitAutocompleteSource,
  hunterIoSource,
  similarwebSource,
  texasBhecSource,
  healthgradesSource,
  // Phase 2 — additional therapist directories (added 2026-05). Each
  // is a direct-URL fast-path scraper: the lead.currentWebsite must
  // point at the directory profile to match. Search-based fallbacks
  // can be added later when needed.
  zencareSource,
  almaSource,
  growTherapySource,
  therapyDenSource,
  // A1 (founder 2026-05-19) — photo cascade source.
  practitionerPhotosSource,
];

// Synthesis sources run sequentially AFTER primary persists, so each
// one can read the freshest payloads via the database. Order matters:
// aiDesignAudit reads ai_synthesis output, so it MUST run after it.
const SYNTHESIS_SOURCES: EnrichmentSource[] = [
  aiSynthesisSource,
  aiDesignAuditSource,
];

const REGISTERED_SOURCES: EnrichmentSource[] = [
  ...PRIMARY_SOURCES,
  ...SYNTHESIS_SOURCES,
];

/** Total number of enrichment sources currently registered. Exported so the
 * dashboard can compute "Enrichment completeness X/N". */
export const TOTAL_ENRICHMENT_SOURCES = REGISTERED_SOURCES.length;

/** True if at least one enrichment source has the credentials it needs. Used
 * to gate fire-and-forget auto-enrich on portal load. */
export const isAnyEnrichmentSourceConfigured = (): boolean =>
  REGISTERED_SOURCES.some((s) => s.isConfigured());

/** Stable list of registered source keys, used for targeted enrichment runs. */
export const REGISTERED_ENRICHMENT_SOURCE_KEYS: readonly string[] =
  REGISTERED_SOURCES.map((s) => s.key);

const toLeadInput = (l: typeof leads.$inferSelect): LeadInput => ({
  id: l.id,
  name: l.name,
  practice: l.practice,
  specialty: l.specialty,
  city: l.city,
  state: l.state,
  phone: l.phone,
  email: l.email,
  currentWebsite: l.currentWebsite,
  placeId: l.placeId,
});

/**
 * Run all configured sources in parallel for a lead. Persists each non-null
 * result to `lead_enrichment` and a summary row to `enrichment_runs`.
 *
 * Returns the run summary. Designed to be safe to call from a fire-and-forget
 * `void` invocation (e.g. on lead creation) — never throws.
 */
export const runEnrichmentForLead = async (
  leadId: number,
  triggerKind: "auto" | "manual" | "scheduled" = "auto",
): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  errors: Record<string, string>;
}> => {
  try {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    if (!lead) {
      logger.warn({ leadId }, "enrichment: lead not found");
      return { attempted: 0, succeeded: 0, failed: 0, errors: {} };
    }
    const input = toLeadInput(lead);
    const configured = REGISTERED_SOURCES.filter((s) => s.isConfigured());
    const [run] = await db
      .insert(enrichmentRuns)
      .values({
        leadId,
        triggerKind,
        sourcesAttempted: configured.length,
      })
      .returning();
    const errors: Record<string, string> = {};
    let succeeded = 0;
    let failed = 0;
    // Phase 1: primary sources run in parallel.
    const primary = configured.filter((s) =>
      PRIMARY_SOURCES.includes(s),
    );
    const primaryResults = await Promise.allSettled(
      primary.map(async (s) => {
        try {
          const result = await s.fetch(input);
          return { source: s, result };
        } catch (err) {
          errors[s.key] = err instanceof Error ? err.message : String(err);
          return { source: s, result: null as FetchResult };
        }
      }),
    );
    for (const r of primaryResults) {
      if (r.status !== "fulfilled") {
        failed++;
        continue;
      }
      const { source, result } = r.value;
      // Three outcomes — see types.ts:FetchResult:
      //   * Candidate          → upsert
      //   * RejectedCandidate  → DELETE existing row (clean up stale
      //                          wrong-match data from a previous run
      //                          before the new identity gates fired)
      //   * null               → preserve existing row (transient
      //                          miss; previous run's good data
      //                          should survive)
      if (isRejected(result)) {
        await deleteSourceRow(leadId, source.key);
        logger.info(
          { leadId, sourceKey: source.key, reason: result.reason },
          "enrichment: source rejected match — purged stale row",
        );
        succeeded++;
        continue;
      }
      if (!result) {
        if (!errors[source.key]) succeeded++;
        else failed++;
        continue;
      }
      await persistCandidate(leadId, source.key, result);
      succeeded++;
    }
    // Phase 2: synthesis sources run sequentially AFTER primary persisted,
    // so they can read the freshest payloads via the database.
    const synthesis = configured.filter((s) =>
      SYNTHESIS_SOURCES.includes(s),
    );
    for (const s of synthesis) {
      try {
        const result = await s.fetch(input);
        if (isRejected(result)) {
          await deleteSourceRow(leadId, s.key);
          succeeded++;
        } else if (result) {
          await persistCandidate(leadId, s.key, result);
          succeeded++;
        } else {
          succeeded++;
        }
      } catch (err) {
        errors[s.key] = err instanceof Error ? err.message : String(err);
        failed++;
      }
    }
    await db
      .update(enrichmentRuns)
      .set({
        sourcesSucceeded: succeeded,
        sourcesFailed: failed,
        errorsJson: Object.keys(errors).length > 0 ? errors : null,
        finishedAt: new Date(),
      })
      .where(eq(enrichmentRuns.id, run.id));
    logger.info(
      { leadId, attempted: configured.length, succeeded, failed },
      "enrichment run finished",
    );
    // Refresh lead quality score from the latest enrichment payloads.
    // Fire-and-forget — scoring failure must never block enrichment. #212.
    void computeLeadScore(leadId).catch((err) => {
      logger.warn({ err, leadId }, "post-enrichment score refresh failed");
    });
    return {
      attempted: configured.length,
      succeeded,
      failed,
      errors,
    };
  } catch (err) {
    logger.error({ err, leadId }, "enrichment orchestrator crashed");
    return {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: { _orchestrator: err instanceof Error ? err.message : String(err) },
    };
  }
};

const persistCandidate = async (
  leadId: number,
  sourceKey: string,
  candidate: Candidate,
) => {
  // Dedup: a (lead, source) pair should have exactly one row — the freshest.
  // Earlier runs were appending, which polluted the mapper's "latest" lookup
  // and wasted DB space. Delete-then-insert keeps the schema simple.
  await db
    .delete(leadEnrichment)
    .where(
      sql`${leadEnrichment.leadId} = ${leadId} AND ${leadEnrichment.sourceKey} = ${sourceKey}`,
    );
  await db.insert(leadEnrichment).values({
    leadId,
    sourceKey,
    confidence: candidate.confidence,
    payload: candidate.payload,
    summary: candidate.summary ?? null,
  });
};

/**
 * Delete the existing enrichment row for `(leadId, sourceKey)`. Used
 * when a source returns a `RejectedCandidate` so any stale row from
 * a previous run that was matched before our identity gates fired
 * gets cleaned up. Tara/Rehab-Accomplished case: Google Places had
 * a stored "Rehab Accomplished" row that survived two re-enrichment
 * runs because the new reject path didn't write anything (and the
 * delete-then-insert lived inside `persistCandidate`).
 */
const deleteSourceRow = async (leadId: number, sourceKey: string) => {
  await db
    .delete(leadEnrichment)
    .where(
      sql`${leadEnrichment.leadId} = ${leadId} AND ${leadEnrichment.sourceKey} = ${sourceKey}`,
    );
};

/**
 * Run only the listed sources for a lead. Used to refresh specific missing
 * fields (e.g. just the website scrape when the hero image is missing) so we
 * don't re-spend on every upstream when only one matters.
 *
 * Same persistence + summary semantics as {@link runEnrichmentForLead}.
 */
export const runEnrichmentForLeadTargeted = async (
  leadId: number,
  sourceKeys: readonly string[],
  triggerKind: "auto" | "manual" | "scheduled" = "auto",
): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  errors: Record<string, string>;
}> => {
  const wanted = new Set(sourceKeys);
  if (wanted.size === 0) {
    return { attempted: 0, succeeded: 0, failed: 0, errors: {} };
  }
  try {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    if (!lead) {
      logger.warn({ leadId }, "targeted enrichment: lead not found");
      return { attempted: 0, succeeded: 0, failed: 0, errors: {} };
    }
    const input = toLeadInput(lead);
    const configured = REGISTERED_SOURCES.filter(
      (s) => wanted.has(s.key) && s.isConfigured(),
    );
    if (configured.length === 0) {
      return { attempted: 0, succeeded: 0, failed: 0, errors: {} };
    }
    const [run] = await db
      .insert(enrichmentRuns)
      .values({
        leadId,
        triggerKind,
        sourcesAttempted: configured.length,
      })
      .returning();
    const errors: Record<string, string> = {};
    const results = await Promise.allSettled(
      configured.map(async (s) => {
        try {
          const result = await s.fetch(input);
          return { source: s, result };
        } catch (err) {
          errors[s.key] = err instanceof Error ? err.message : String(err);
          return { source: s, result: null as FetchResult };
        }
      }),
    );
    let succeeded = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status !== "fulfilled") {
        failed++;
        continue;
      }
      const { source, result } = r.value;
      if (isRejected(result)) {
        await deleteSourceRow(leadId, source.key);
        logger.info(
          { leadId, sourceKey: source.key, reason: result.reason },
          "enrichment (targeted): source rejected match — purged stale row",
        );
        succeeded++;
        continue;
      }
      if (!result) {
        if (!errors[source.key]) succeeded++;
        else failed++;
        continue;
      }
      await persistCandidate(leadId, source.key, result);
      succeeded++;
    }
    await db
      .update(enrichmentRuns)
      .set({
        sourcesSucceeded: succeeded,
        sourcesFailed: failed,
        errorsJson: Object.keys(errors).length > 0 ? errors : null,
        finishedAt: new Date(),
      })
      .where(eq(enrichmentRuns.id, run.id));
    logger.info(
      {
        leadId,
        attempted: configured.length,
        succeeded,
        failed,
        targeted: Array.from(wanted),
      },
      "targeted enrichment run finished",
    );
    // Refresh lead quality score from the latest enrichment payloads.
    // Fire-and-forget — scoring failure must never block enrichment
    // (which is itself fire-and-forget from most call sites). #212.
    void computeLeadScore(leadId).catch((err) => {
      logger.warn({ err, leadId }, "post-enrichment score refresh failed");
    });
    return { attempted: configured.length, succeeded, failed, errors };
  } catch (err) {
    logger.error(
      { err, leadId, sourceKeys: Array.from(wanted) },
      "targeted enrichment orchestrator crashed",
    );
    return {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: { _orchestrator: err instanceof Error ? err.message : String(err) },
    };
  }
};

/**
 * Returns the latest enrichment payload per source for a lead, keyed by
 * sourceKey. Useful for the rep timeline + briefing AI.
 */
export const getLatestEnrichment = async (leadId: number) => {
  const rows = await db
    .select()
    .from(leadEnrichment)
    .where(eq(leadEnrichment.leadId, leadId))
    .orderBy(desc(leadEnrichment.fetchedAt));
  const byKey = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!byKey.has(r.sourceKey)) byKey.set(r.sourceKey, r);
  }
  return Array.from(byKey.values());
};
