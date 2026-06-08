import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    repId: integer("rep_id")
      .notNull()
      .references(() => salesReps.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 192 }).notNull(),
    body: text("body"),
    payload: jsonb("payload"),
    linkUrl: varchar("link_url", { length: 256 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    repIdx: index("notifications_rep_idx").on(t.repId, t.createdAt),
  }),
);

export type Notification = typeof notifications.$inferSelect;

// 2026-05-14 audit fix #7: rep can @-mention the owner inside a note
// (e.g. "@Ashford the prospect wants to add an intake form"). When the
// regex /@Ashford\b/i hits in addLeadRepNote, we insert an admin-level
// notification here and fire an email so the owner can act on it.
export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: serial("id").primaryKey(),
    kind: varchar("kind", { length: 64 }).notNull(),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    repId: integer("rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unreadFeedIdx: index("admin_notifications_unread_idx").on(
      t.readAt,
      t.createdAt,
    ),
  }),
);

export type AdminNotification = typeof adminNotifications.$inferSelect;
