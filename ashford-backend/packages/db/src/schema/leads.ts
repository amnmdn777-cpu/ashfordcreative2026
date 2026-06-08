import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";

/**
 * Per-lead self-serve metadata captured at Stripe Checkout. Populated only
 * for leads created by the public template flow (Plan A self_serve_template
 * source); always null for rep-claimed / Apify / manually entered leads.
 *
 * Stored as a jsonb blob (rather than 4 columns) because the rep dashboard
 * shows it read-only in a single "self-serve order" card and we expect the
 * shape to evolve (e.g. adding `colorOverrides`, `fontDisplay`) without
 * needing a new migration each time.
 */
export type LeadSelfServeMeta = {
  templateKey?: string;
  paletteKey?: string;
  addons?: string[];
  chosenDomain?: string;
  /** Optional UUID linking the lead back to public funnel_events rows. */
  funnelSessionId?: string;
};

export const leadStatusEnum = pgEnum("lead_status", [
  "available",
  "claimed",
  "nurturing",
  "won",
  "disqualified",
  "recycled",
  // "cold" = rep parked the lead for later follow-up. Stays claimed to
  // the rep and excluded from stale-claim recycling so they can revisit
  // it manually. Distinct from "disqualified" (workflow-final).
  "cold",
]);

export const disqualifyReasonEnum = pgEnum("disqualify_reason", [
  "not_interested",
  "wrong_number",
  "do_not_call",
  "already_has_provider",
  "out_of_market",
  "budget_concern",
  "other",
]);

// Rep-pickable lead temperature — orthogonal to lead_status. The rep
// sets it from the lead detail page to communicate conversion read.
// Migration 0028 seeds in-progress leads to 'hot'.
export const leadTemperatureEnum = pgEnum("lead_temperature", [
  "disqualifier",
  "cold",
  "lukewarm",
  "hot",
]);

// Feature B (founder 2026-05-19): Preview Quality Check enums.
export const qcStatusEnum = pgEnum("qc_status", ["none", "validated", "stale"]);
export const qcSourceEnum = pgEnum("qc_source", ["manual", "script"]);
export const qcEventTypeEnum = pgEnum("qc_event_type", [
  "validated",
  "invalidated",
  "reset",
  "field_locked",
  "field_unlocked",
  "blocked_no_photo",
]);

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    practice: varchar("practice", { length: 192 }).notNull(),
    // LOT 2.1 — audit/rollback column for the title-case backfill.
    // Holds the corrupted pre-backfill value (e.g. "Bwbh The Rapy"); NULL
    // for rows that were never touched by the backfill script.
    practiceOriginal: varchar("practice_original", { length: 255 }),
    specialty: varchar("specialty", { length: 96 }).notNull(),
    city: varchar("city", { length: 64 }).notNull(),
    state: varchar("state", { length: 2 }).notNull().default("TX"),
    phone: varchar("phone", { length: 32 }).notNull(),
    email: varchar("email", { length: 192 }),
    locale: varchar("locale", { length: 5 }).notNull().default("en"),
    currentWebsite: varchar("current_website", { length: 256 }),
    placeId: varchar("place_id", { length: 96 }),
    profileBlurb: text("profile_blurb"),
    status: leadStatusEnum("status").notNull().default("available"),
    claimedByRepId: integer("claimed_by_rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    disqualifyReason: disqualifyReasonEnum("disqualify_reason"),
    temperature: leadTemperatureEnum("temperature"),
    disqualifyNote: text("disqualify_note"),
    /**
     * LEGACY NOTES (#224 founder feedback 2026-05-08): this column was
     * hijacked at import time by `scripts/importLeads.ts` to store the
     * Apify-scraped Psychology Today profile dump (Qualifications,
     * Approach, PsychologyToday URL). It is read-only "enrichment notes"
     * for the rep and is read-only in the dashboard. The rep's own
     * free-form notes live in the {@link leadRepNotes} journal table.
     */
    notes: text("notes"),
    /**
     * 0-100 quality score computed by `computeLeadScore` from the lead's
     * latest enrichment payload (Google rating × review count, web stack
     * tier, has-email, source quality, etc). NULL for leads that have
     * never been scored — these sort to the END of the available-leads
     * pool via `ORDER BY lead_score DESC NULLS LAST`. Score breakdown
     * is stored in {@link scoreBreakdown} as a per-signal jsonb so the
     * rep dashboard can show "why this is hot" in a tooltip.
     *
     * Backfilled by scripts/backfillLeadScores.ts; refreshed automatically
     * at the end of each enrichment orchestrator run.
     */
    leadScore: integer("lead_score"),
    scoreBreakdown: jsonb("score_breakdown").$type<{
      total: number;
      tier: "A" | "B" | "C";
      signals: Array<{ key: string; label: string; points: number; max: number; note?: string }>;
    }>(),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    /**
     * Provenance marker for analytics + dashboard segmentation. Examples:
     *   - "self_serve_template" — public Plan A checkout (auto-created
     *     by stripeWebhook on checkout.session.completed when there's no
     *     pre-existing lead to attribute the sale to).
     *   - "rep_manual"          — rep typed the lead into the dashboard.
     *   - "apify_import"        — bulk import from the Apify pipeline.
     *   - "contact_form"        — submitted via the public site contact form.
     * Nullable so historical leads (pre-#161) keep their existing semantics.
     */
    source: varchar("source", { length: 32 }),
    /** See {@link LeadSelfServeMeta}. Populated when source = "self_serve_template". */
    selfServeMeta: jsonb("self_serve_meta").$type<LeadSelfServeMeta>(),
    calendlyUrl: varchar("calendly_url", { length: 256 }),
    doxyUrl: varchar("doxy_url", { length: 256 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("leads_status_idx").on(t.status),
    claimedByIdx: index("leads_claimed_by_idx").on(t.claimedByRepId),
    cityIdx: index("leads_city_idx").on(t.city),
    phoneIdx: index("leads_phone_idx").on(t.phone),
    sourceIdx: index("leads_source_idx").on(t.source),
    leadScoreIdx: index("leads_lead_score_idx").on(t.leadScore),
  }),
);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Append-only journal of free-form rep notes for a lead. Replaces the
 * legacy single-textarea `leads.rep_notes` column (#229 founder feedback
 * 2026-05-11): reps wanted to see conversations, follow-ups, and context
 * over time as discrete timestamped entries instead of one ever-edited
 * blob. Strictly append-only — there is no UPDATE/DELETE path; a typo
 * gets a follow-up note, not a rewrite, so the rep can always trust the
 * history.
 *
 * `authorRepId` is nullable so seeded entries (migrated from the old
 * `leads.rep_notes` column) and entries whose author has since been
 * deleted both keep their text. New entries always carry an author.
 */
export const leadRepNotes = pgTable(
  "lead_rep_notes",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    authorRepId: integer("author_rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Edit history (#231, 2026-05-14). When a rep edits their own note,
    // `originalBody` captures the very first body the note was created
    // with (set once, never overwritten on subsequent edits), and
    // `editedAt` is updated on every edit. NULL on both = note has
    // never been edited. The rep app shows a "modified" tag with the
    // original body on hover. Ownership is enforced server-side: only
    // the original author can edit; admins cannot (audit-clean).
    originalBody: text("original_body"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => ({
    leadIdIdx: index("lead_rep_notes_lead_id_idx").on(t.leadId),
  }),
);

export type LeadRepNote = typeof leadRepNotes.$inferSelect;
export type InsertLeadRepNote = typeof leadRepNotes.$inferInsert;

/**
 * #230 protection — every DELETE on `lead_rep_notes` is mirrored here
 * by a BEFORE DELETE trigger (migration 0022). This is the parachute:
 * even if the wipe endpoint, a manual psql DELETE, or any future bug
 * removes notes, the bodies survive here forever (no app-level deletion
 * path) and can be restored via the admin "Archive" panel.
 *
 * `deletedByPgUser` is captured by Postgres itself (`current_user`);
 * `deletedByAppActor` is the optional JSON the app sets via
 * `SET LOCAL app.deletion_actor = '...'` inside the same transaction
 * so we know WHICH rep/admin triggered the delete from the application
 * side (not just the DB credential, which is shared).
 */
export const leadRepNotesArchive = pgTable(
  "lead_rep_notes_archive",
  {
    archiveId: serial("archive_id").primaryKey(),
    originalId: integer("original_id").notNull(),
    leadId: integer("lead_id").notNull(),
    authorRepId: integer("author_rep_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedByPgUser: text("deleted_by_pg_user").notNull(),
    deletedByAppActor: jsonb("deleted_by_app_actor"),
  },
  (t) => ({
    leadIdx: index("lead_rep_notes_archive_lead_idx").on(t.leadId),
    authorIdx: index("lead_rep_notes_archive_author_idx").on(t.authorRepId),
    deletedAtIdx: index("lead_rep_notes_archive_deleted_at_idx").on(t.deletedAt),
  }),
);
export type LeadRepNoteArchive = typeof leadRepNotesArchive.$inferSelect;


// Audit trail for every QC state change.
export const leadQcEvents = pgTable(
  "lead_qc_events",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    eventType: qcEventTypeEnum("event_type").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// Field-level locks — validated leads keep listed fields immutable.
export const leadFieldLocks = pgTable(
  "lead_field_locks",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    fieldName: text("field_name").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedBy: text("locked_by").notNull(),
  },
  (t) => ({
    uniqLeadField: uniqueIndex("uniq_lead_field_locks").on(t.leadId, t.fieldName),
  }),
);

export type LeadQcEvent = typeof leadQcEvents.$inferSelect;
export type InsertLeadQcEvent = typeof leadQcEvents.$inferInsert;
export type LeadFieldLock = typeof leadFieldLocks.$inferSelect;
export type InsertLeadFieldLock = typeof leadFieldLocks.$inferInsert;
