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
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";

export const prospectLinks = pgTable(
  "prospect_links",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    repId: integer("rep_id")
      .notNull()
      .references(() => salesReps.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("prospect_links_lead_idx").on(t.leadId),
  }),
);

export const linkEventTypeEnum = pgEnum("link_event_type", [
  "opened",
  "viewed_template",
  "preferred_template",
  "requested_changes",
  "requested_callback",
  "payment_link_sent",
]);

export const linkEvents = pgTable(
  "link_events",
  {
    id: serial("id").primaryKey(),
    linkId: integer("link_id")
      .notNull()
      .references(() => prospectLinks.id, { onDelete: "cascade" }),
    eventType: linkEventTypeEnum("event_type").notNull(),
    templateKey: varchar("template_key", { length: 32 }),
    changeRequestText: text("change_request_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    userAgent: varchar("user_agent", { length: 256 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    linkIdx: index("link_events_link_idx").on(t.linkId),
  }),
);

export type ProspectLink = typeof prospectLinks.$inferSelect;
export type LinkEvent = typeof linkEvents.$inferSelect;
