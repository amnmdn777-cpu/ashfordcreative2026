import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

export const leadContacts = pgTable(
  "lead_contacts",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 8 }).notNull(), // 'phone' | 'email'
    value: varchar("value", { length: 256 }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    label: varchar("label", { length: 64 }), // e.g. "cell", "office", "work"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdIdx: index("lead_contacts_lead_id_idx").on(t.leadId),
    primaryUniqIdx: uniqueIndex("lead_contacts_primary_idx")
      .on(t.leadId, t.kind)
      .where(sql`is_primary = true`),
  })
);

export type LeadContact = typeof leadContacts.$inferSelect;
export type InsertLeadContact = typeof leadContacts.$inferInsert;
