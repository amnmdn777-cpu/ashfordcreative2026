import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

/**
 * Append-only log of clicks on the site's WhatsApp floating button.
 *
 * We don't run the WhatsApp Business API on Candice's number — it stays
 * a regular personal WhatsApp — so this table is the only signal we
 * have that a visitor opened a conversation with her. We capture
 * everything we can BEFORE handing the visitor off to `wa.me`:
 *   - which template / page they were on
 *   - locale (en/es)
 *   - opaque session id (joins to funnel_events for the same visit)
 *   - optional lead_id when the click came from an authenticated portal
 *   - user agent + ip for spam triage
 *
 * The actual message content is never seen by the server — that's the
 * point of using wa.me. The admin dashboard shows the click log so the
 * founder can correlate "Candice told me she got a new lead" with
 * "yes, here's the page that drove it".
 *
 * Schema is intentionally narrow + append-only. No status enum, no
 * mark-as-replied — that would require us to fill the gaps that only
 * the WhatsApp Business API can fill, and the founder explicitly
 * asked for the click-tracking version only.
 */
export const whatsappClicks = pgTable(
  "whatsapp_clicks",
  {
    id: serial("id").primaryKey(),
    /** Opaque visitor session id (matches funnel_events.session_id when set). */
    sessionId: varchar("session_id", { length: 64 }),
    /** Template slug the visitor was on (atrium, garden, sunrise, …). */
    templateKey: varchar("template_key", { length: 64 }),
    /** Pathname (truncated to 256 chars). */
    pagePath: varchar("page_path", { length: 256 }),
    /** Free-form referrer (truncated). */
    referrer: varchar("referrer", { length: 512 }),
    /** "en" or "es". */
    locale: varchar("locale", { length: 8 }),
    /** Optional lead id when the click came from a logged-in portal. */
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    /** Truncated UA — for browser/device breakdowns only, no fingerprinting. */
    userAgent: varchar("user_agent", { length: 512 }),
    /** IP captured from x-forwarded-for / req.ip. */
    ipAddress: varchar("ip_address", { length: 64 }),
    /** Optional free-form note (e.g. UTM, deep-link source). */
    note: text("note"),
    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clickedIdx: index("whatsapp_clicks_clicked_idx").on(t.clickedAt),
    sessionIdx: index("whatsapp_clicks_session_idx").on(t.sessionId),
    templateIdx: index("whatsapp_clicks_template_idx").on(t.templateKey),
    leadIdx: index("whatsapp_clicks_lead_idx").on(t.leadId),
  }),
);

export type WhatsappClick = typeof whatsappClicks.$inferSelect;
export type InsertWhatsappClick = typeof whatsappClicks.$inferInsert;
