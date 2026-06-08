import {
  pgTable,
  serial,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Append-only stream of public-funnel events for the self-serve template
 * flow (Plan A). Each row records one user action — page view, template
 * selection, palette change, addon toggle, customize, reserve click,
 * reserve confirm — keyed by an opaque sessionId so we can reconstruct
 * the per-visitor journey without a login.
 *
 * The same `funnelSessionId` is propagated as Stripe Checkout `metadata`
 * so when the webhook fires `checkout.session.completed` we can join the
 * resulting `leads` row back to its funnel events for cohort analysis.
 *
 * Append-only: no UPDATE, no DELETE. The admin endpoint reads only the
 * last N days. Schema is intentionally narrow (no FK to leads) because
 * 95% of funnel sessions never convert and we don't want orphaned-row
 * cleanup on the hot path.
 */
export const funnelEvents = pgTable(
  "funnel_events",
  {
    id: serial("id").primaryKey(),
    /** Opaque, client-minted UUID. SessionStorage-scoped (per-tab). */
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    /**
     * Free-form event name. Current vocabulary (keep in sync with the
     * client tracker in `artifacts/ashford-site/src/lib/funnel.ts`):
     *   template_view | template_pick | palette_pick | addon_toggle |
     *   customize_open | reserve_open | reserve_submit | checkout_start
     */
    event: varchar("event", { length: 48 }).notNull(),
    /** Optional template slug the event happened on (for filter/cohort). */
    slug: varchar("slug", { length: 64 }),
    /** Free-form payload — rate-limit at the route level keeps it small. */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sessionIdx: index("funnel_events_session_idx").on(t.sessionId),
    createdIdx: index("funnel_events_created_idx").on(t.createdAt),
    eventIdx: index("funnel_events_event_idx").on(t.event),
  }),
);

export type FunnelEvent = typeof funnelEvents.$inferSelect;
export type InsertFunnelEvent = typeof funnelEvents.$inferInsert;
