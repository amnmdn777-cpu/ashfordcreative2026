import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";
import { salesReps } from "./reps";

/**
 * Bundle 3 — supporting files attached to a lead (PDFs, images, docs). The
 * bytes live in the existing object storage (R2/S3); this row keeps the
 * metadata + the storage key so the file can be listed, downloaded, and
 * deleted. Cascades on lead delete.
 */
export const leadAttachments = pgTable(
  "lead_attachments",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 256 }).notNull(),
    filename: varchar("filename", { length: 256 }).notNull(),
    contentType: varchar("content_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedByRepId: integer("uploaded_by_rep_id").references(
      () => salesReps.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdIdx: index("lead_attachments_lead_id_idx").on(t.leadId),
  }),
);

export type LeadAttachment = typeof leadAttachments.$inferSelect;
export type InsertLeadAttachment = typeof leadAttachments.$inferInsert;
