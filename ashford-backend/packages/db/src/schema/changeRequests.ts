import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";
import { prospectPortals } from "./portals";
import { salesReps } from "./reps";

/**
 * 2026-05-21 — Post-launch self-serve change requests (Sprint 2 streamline).
 *
 * After Sprint 2 killed the client-onboarding flow, the only way for a
 * client to ask for a site change used to be emailing hello@. This table
 * backs the new portal-side "Request a change" form: the client uses
 * their existing 90-day portal token, the request lands here, and the
 * rep sees it in the lead detail page (no email loop — the rep is
 * already in her dashboard daily).
 */
export const changeRequests = pgTable(
  "change_requests",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    portalId: integer("portal_id").references(() => prospectPortals.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    /** "open" or "resolved". Plain text so adding a third state later
     *  doesn't require an enum migration. */
    status: text("status").notNull().default("open"),
    /** Channel the request came from. "portal" is the only emitter for
     *  now; reserved for future "rep adds note on behalf of client". */
    submittedVia: text("submitted_via").notNull().default("portal"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByRepId: integer("resolved_by_rep_id").references(
      () => salesReps.id,
      { onDelete: "set null" },
    ),
  },
  (t) => ({
    leadIdx: index("change_requests_lead_id_idx").on(t.leadId),
    statusIdx: index("change_requests_status_idx").on(t.status),
    createdAtIdx: index("change_requests_created_at_idx").on(t.createdAt),
  }),
);

export type ChangeRequest = typeof changeRequests.$inferSelect;
export type NewChangeRequest = typeof changeRequests.$inferInsert;
