import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

/**
 * Per-source raw enrichment payloads for a lead. We keep the raw JSON so
 * downstream consumers (template renderer, AI briefing) can re-parse later
 * without re-hitting the upstream API. Confidence is set by the source
 * adapter (0-100) so the orchestrator can pick the best candidate when
 * multiple sources disagree.
 */
export const leadEnrichment = pgTable(
  "lead_enrichment",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sourceKey: varchar("source_key", { length: 48 }).notNull(),
    confidence: integer("confidence").notNull().default(0),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    summary: text("summary"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("lead_enrichment_lead_idx").on(t.leadId),
    sourceIdx: index("lead_enrichment_source_idx").on(t.sourceKey),
  }),
);

/**
 * One row per orchestrator run for a lead. Tracks how many sources
 * succeeded vs failed so reps can spot leads that need a manual refresh
 * (e.g. all 12 sources soft-failed → likely a data-quality problem).
 */
export const enrichmentRuns = pgTable(
  "enrichment_runs",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    triggerKind: varchar("trigger_kind", { length: 24 })
      .notNull()
      .default("auto"),
    sourcesAttempted: integer("sources_attempted").notNull().default(0),
    sourcesSucceeded: integer("sources_succeeded").notNull().default(0),
    sourcesFailed: integer("sources_failed").notNull().default(0),
    errorsJson: jsonb("errors_json").$type<Record<string, string>>(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    leadIdx: index("enrichment_runs_lead_idx").on(t.leadId),
  }),
);

/**
 * HTML cache for directory scrapers (Headway, PT, Healthgrades,
 * Zencare, Alma, Grow Therapy, TherapyDen). Each row stores the
 * fetched HTML for a profile URL with a timestamp; the scraper layer
 * checks for a fresh row (<= 30 days old) before paying ScraperAPI
 * to re-fetch. The same URL is often hit multiple times — once on
 * lead create, once when the rep opens a preview, once per re-
 * enrichment cycle. Caching cuts ScraperAPI spend ~5-10x.
 *
 * `urlHash` is a SHA-256 of the canonicalized URL (no query, lower-
 * cased host) so we de-duplicate `?utm_source=...` variants of the
 * same profile. The full URL is still stored alongside for debug.
 *
 * Stored HTML can be large (Headway ~1MB rendered). PostgreSQL TEXT
 * handles this fine; we don't compress because we read it back into
 * Node strings anyway.
 */
export const directoryHtmlCache = pgTable(
  "directory_html_cache",
  {
    id: serial("id").primaryKey(),
    urlHash: varchar("url_hash", { length: 64 }).notNull(),
    url: text("url").notNull(),
    sourceKey: varchar("source_key", { length: 48 }).notNull(),
    html: text("html").notNull(),
    bytes: integer("bytes").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    urlHashIdx: index("directory_html_cache_url_hash_idx").on(t.urlHash),
    sourceIdx: index("directory_html_cache_source_idx").on(t.sourceKey),
    fetchedAtIdx: index("directory_html_cache_fetched_at_idx").on(t.fetchedAt),
  }),
);

export type LeadEnrichment = typeof leadEnrichment.$inferSelect;
export type EnrichmentRun = typeof enrichmentRuns.$inferSelect;
export type DirectoryHtmlCache = typeof directoryHtmlCache.$inferSelect;
