import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

export const shortLinks = pgTable(
  "short_links",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 16 }).notNull().unique(),
    targetUrl: text("target_url").notNull(),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    purpose: varchar("purpose", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clickCount: integer("click_count").notNull().default(0),
    lastClickAt: timestamp("last_click_at", { withTimezone: true }),
  },
  (t) => ({
    leadIdx: index("short_links_lead_idx").on(t.leadId),
  }),
);

export type ShortLink = typeof shortLinks.$inferSelect;
export type InsertShortLink = typeof shortLinks.$inferInsert;
