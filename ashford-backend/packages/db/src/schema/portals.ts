import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { leads } from "./leads";

/**
 * LOT 1.4 — portal lifecycle states. See the `lifecycleState` column
 * on prospect_portals for the full contract; in short:
 *   draft (reserved, not gated in 1.4) -> sent -> expired.
 */
export const portalLifecycleEnum = pgEnum("portal_lifecycle", [
  "draft",
  "sent",
  "expired",
]);

/**
 * Permanent personalized portal for a prospect lead. One portal per lead,
 * keyed by a human-readable slug like `dr-rivera-austin`. Unlike the older
 * `prospect_links` (tokenized + ephemeral), portals are durable: the same
 * URL can be re-shared, the prospect can come back any time, and the rep
 * can iterate the personalization in place.
 *
 * `customizations` holds the prospect-side WYSIWYG overrides
 * (palette, typography, photo URL, copy edits). `selectedTemplate` tracks
 * which of the 8 templates the prospect last picked.
 *
 * `enrichmentSnapshot` is a frozen copy of what the enrichment pipeline
 * found at portal-creation time — useful so the portal renders consistently
 * even after a future enrichment refresh changes the underlying data.
 */
export const prospectPortals = pgTable(
  "prospect_portals",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .unique()
      .references(() => leads.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 96 }).notNull().unique(),
    /**
     * Random nonce required to GET or mutate this portal. The slug is
     * human-readable (and therefore guessable); the access token gates the
     * URL behind something only the rep + the prospect (who got the invite)
     * know. Invite links carry it as `?t=<accessToken>`.
     */
    accessToken: varchar("access_token", { length: 48 }).notNull().default(""),
    /**
     * Hard expiry for the access token. Defaults to 90 days from creation.
     * Requests presenting an unexpired token + correct slug get through;
     * once `now() > accessTokenExpiresAt` the public guard returns 401 with
     * `code: "portal_token_expired"` so the SPA can show a friendly
     * "ask your rep for a new link" screen. Reps can mint a fresh token
     * (with a fresh 90-day expiry) from the lead detail page.
     *
     * Existing pre-migration rows are backfilled to `created_at + 90 days`
     * by the one-shot reconciler in `services/portals.ts` so nothing breaks
     * the day this ships.
     */
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    })
      .notNull()
      .default(sql`now() + interval '90 days'`),
    selectedTemplate: varchar("selected_template", { length: 32 })
      .notNull()
      .default("trauma_emdr"),
    customizations: jsonb("customizations")
      .$type<{
        paletteKey?: string;
        typographyKey?: string;
        heroPhotoUrl?: string;
        headline?: string;
        tagline?: string;
        about?: string;
        copyOverrides?: Record<string, string>;
        colorOverrides?: {
          primary?: string;
          accent?: string;
          surface?: string;
          ink?: string;
          muted?: string;
        };
        fontDisplay?: string;
        fontBody?: string;
        pricingPlan?: "boutique" | "boutique_pro" | "boutique_concierge";
      }>()
      .notNull()
      .default({}),
    enrichmentSnapshot: jsonb("enrichment_snapshot").$type<
      Record<string, unknown>
    >(),
    inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    openCount: integer("open_count").notNull().default(0),
    /**
     * Most recent moment a "hot lead" notification fired for this portal.
     * Used both for in-service deduplication (a 30-minute cooldown so the
     * same surge of opens doesn't spam the rep) and for the rep-side
     * "🔥 Hot" badge on the lead detail page (rendered for the next 60
     * minutes after the trigger). Nullable: null means a hot trigger has
     * never fired for this portal.
     */
    lastHotAlertAt: timestamp("last_hot_alert_at", { withTimezone: true }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    /**
     * LOT 1.4 — portal lifecycle gate.
     *
     *   'sent'     — default for live portals; public token URL serves
     *                the preview.
     *   'expired'  — lead reached a terminal status (disqualified | won
     *                | recycled) OR the access token aged past its
     *                expiry. Public path returns 410; rep with
     *                ownership (or admin) bypasses to keep
     *                record-keeping reachable.
     *   'draft'    — reserved. Not gated as a prospect 403 in 1.4 so
     *                seed/demo flows that create-and-load portals
     *                immediately keep working; a follow-up will
     *                tighten this to "rep-only until invite sent".
     *
     * Set the column via `expirePortalForLead()` in services/portals.ts
     * — the helper is idempotent and writes an audit row on each real
     *  transition.
     */
    lifecycleState: portalLifecycleEnum("lifecycle_state")
      .notNull()
      .default("sent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: index("prospect_portals_slug_idx").on(t.slug),
    leadIdx: index("prospect_portals_lead_idx").on(t.leadId),
    lifecycleIdx: index("prospect_portals_lifecycle_idx").on(t.lifecycleState),
  }),
);

export const portalEventTypeEnum = pgEnum("portal_event_type", [
  "opened",
  "template_view",
  "template_selected",
  "customize",
  "addon_view",
  "addon_toggle",
  "cart_update",
  "reserve_clicked",
  "reserve_succeeded",
  "share_link_copied",
  "exit",
  "invite_sent",
  "reengagement_j3_email",
  "reengagement_j7_email",
  "reengagement_j14_email",
  "reengagement_j30_email",
  "reengagement_sequence_closed",
  // Retained for the legacy SMS/rep-alert path written by the pre-Task-#168
  // implementation. Not emitted by current code, but kept in the enum so old
  // portal_events rows still satisfy the column constraint.
  "reengagement_j8_sms",
  "reengagement_j15_rep_alert",
  // Round 8 portal trust signals — both surface in the rep timeline as
  // pre-call reassurance signals (prospect actively de-risking).
  "help_panel_open",
  "faq_open",
]);

/**
 * Per-event tracking from the portal experience. We collect enough to power
 * a meaningful pre-call AI briefing (which addons did they hover, which
 * template did they keep coming back to, did they make it to the reserve
 * step) without storing PII other than what the prospect explicitly typed.
 */
export const portalEvents = pgTable(
  "portal_events",
  {
    id: serial("id").primaryKey(),
    portalId: integer("portal_id")
      .notNull()
      .references(() => prospectPortals.id, { onDelete: "cascade" }),
    eventType: portalEventTypeEnum("event_type").notNull(),
    templateKey: varchar("template_key", { length: 32 }),
    addonSlug: varchar("addon_slug", { length: 48 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    sessionId: varchar("session_id", { length: 64 }),
    durationMs: integer("duration_ms"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    portalIdx: index("portal_events_portal_idx").on(t.portalId),
    typeIdx: index("portal_events_type_idx").on(t.eventType),
  }),
);

/**
 * Latest "cart" state for a portal — which template + add-ons the prospect
 * has currently selected. Updated as the prospect toggles things; the most
 * recent row is the live cart. We snapshot the full cart on each update so
 * a rep can see the prospect's deliberation trail (e.g. "they had Sanctuary
 * in the cart for 8 minutes then removed it").
 */
export const portalCarts = pgTable(
  "portal_carts",
  {
    id: serial("id").primaryKey(),
    portalId: integer("portal_id")
      .notNull()
      .references(() => prospectPortals.id, { onDelete: "cascade" }),
    templateKey: varchar("template_key", { length: 32 }).notNull(),
    addonSlugs: jsonb("addon_slugs").$type<string[]>().notNull().default([]),
    monthlyTotalCents: integer("monthly_total_cents").notNull().default(19900),
    setupTotalCents: integer("setup_total_cents").notNull().default(0),
    // LOT 1.3 — distinguishes a real prospect-session write from a
    // rep-bypass (authenticated rep previewing the portal). Hot-lead
    // aggregation filters to 'prospect' so a rep QA pass can't spoof
    // a prospect signal. CHECK constraint enforced in migration 0017.
    source: varchar("source", { length: 16 }).notNull().default("prospect"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    portalIdx: index("portal_carts_portal_idx").on(t.portalId),
  }),
);

/**
 * LOT 1.3 — server-side store for the `ash_prospect_<slug>` cookie.
 * The cookie value is never persisted raw: we store SHA-256(token) and
 * compare on each cart write. Mints on first GET /public/portals/:slug
 * and lives for 90 days (mirrors the existing access-token TTL). ip
 * and userAgent are captured at mint time for the rep-side timeline
 * ("first opened from <ip> on <browser>").
 */
export const portalProspectSessions = pgTable(
  "portal_prospect_sessions",
  {
    id: serial("id").primaryKey(),
    portalId: integer("portal_id")
      .notNull()
      .references(() => prospectPortals.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    portalIdx: index("portal_prospect_sessions_portal_idx").on(t.portalId),
  }),
);

export type PortalProspectSession =
  typeof portalProspectSessions.$inferSelect;

export type ProspectPortal = typeof prospectPortals.$inferSelect;
export type InsertProspectPortal = typeof prospectPortals.$inferInsert;
export type PortalEvent = typeof portalEvents.$inferSelect;
export type PortalCart = typeof portalCarts.$inferSelect;

/**
 * Catalog of demo add-ons the prospect can preview alongside their site
 * preview. These are NEVER charged at base reserve time — they generate
 * waitlist signals (rows in `addon_interest_signals`) which the rep then
 * works to convert into custom-dev quotes. Pricing is locked at the moment
 * of capture so a later catalog price change can't surprise the customer.
 */
export const addonCatalog = pgTable("addon_catalog", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 48 }).notNull().unique(),
  name: varchar("name", { length: 96 }).notNull(),
  shortDescription: text("short_description").notNull(),
  monthlyCents: integer("monthly_cents").notNull(),
  /**
   * Original (pre-discount) monthly price in cents. When non-null and
   * greater than `monthlyCents` the portal renders a struck-through
   * price next to the "Included" / current price so the prospect sees
   * the discount they're getting (e.g. free first add-on).
   */
  originalMonthlyCents: integer("original_monthly_cents"),
  perPatientCents: integer("per_patient_cents"),
  setupCents: integer("setup_cents").notNull().default(0),
  bundleSlug: varchar("bundle_slug", { length: 48 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A prospect "raised hand" for a specific add-on at a specific moment.
 * Created either when they toggled the add-on into the cart at reserve time
 * (signalKind = 'reserved_with') or when they explicitly clicked "Notify me"
 * on a preview without going through reserve (signalKind = 'waitlist').
 *
 * Locked-in price is captured here so later quote builders honor the price
 * the prospect saw.
 */
export const addonInterestSignals = pgTable(
  "addon_interest_signals",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    portalId: integer("portal_id").references(() => prospectPortals.id, {
      onDelete: "set null",
    }),
    addonSlug: varchar("addon_slug", { length: 48 }).notNull(),
    signalKind: varchar("signal_kind", { length: 24 })
      .notNull()
      .default("waitlist"),
    lockedMonthlyCents: integer("locked_monthly_cents").notNull(),
    lockedPerPatientCents: integer("locked_per_patient_cents"),
    lockedSetupCents: integer("locked_setup_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("addon_interest_signals_lead_idx").on(t.leadId),
    addonIdx: index("addon_interest_signals_addon_idx").on(t.addonSlug),
  }),
);

export type AddonCatalog = typeof addonCatalog.$inferSelect;
export type AddonInterestSignal = typeof addonInterestSignals.$inferSelect;
