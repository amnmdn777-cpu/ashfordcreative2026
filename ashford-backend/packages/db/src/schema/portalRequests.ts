import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";

/**
 * Sprint 1 (2026-05-22) — portal request workflow.
 *
 * Replaces the old auto-on-lead-open portal creation flow. The new
 * model: the rep (Candice) explicitly clicks "Demander un portail" on
 * the lead detail page when she's ready for the admin (founder) to
 * hand-craft a portal for that prospect. The row stays `pending` until
 * the admin marks it `handled` from the dashboard card.
 *
 * The admin then fills the portal data manually (no auto-enrichment)
 * via the upcoming `portal-data/<slug>.ts` file convention (Sprint 2).
 */
export const portalRequestStatusEnum = pgEnum("portal_request_status", [
  "pending",
  "handled",
]);

export const portalRequests = pgTable(
  "portal_requests",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Rep who clicked "Demander un portail" (typically Candice). */
    requestedByRepId: integer("requested_by_rep_id")
      .notNull()
      .references(() => salesReps.id, { onDelete: "cascade" }),
    /** Optional free-form note typed in the modal at request time. */
    message: text("message"),
    status: portalRequestStatusEnum("status").notNull().default("pending"),
    /** Admin user (sales_reps role='admin') who marked the request handled. */
    handledByRepId: integer("handled_by_rep_id").references(
      () => salesReps.id,
      { onDelete: "set null" },
    ),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("portal_requests_status_idx").on(t.status, t.createdAt),
    leadIdx: index("portal_requests_lead_idx").on(t.leadId),
    repIdx: index("portal_requests_rep_idx").on(t.requestedByRepId, t.createdAt),
  }),
);

export type PortalRequest = typeof portalRequests.$inferSelect;
export type InsertPortalRequest = typeof portalRequests.$inferInsert;
