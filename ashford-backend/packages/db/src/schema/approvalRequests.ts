import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";
import { sales } from "./stripe";

export const approvalKindEnum = pgEnum("approval_kind", [
  "setup_fee_discount",
  "free_first_month",
  "refund_invoice",
  "custom_addon_price",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "denied",
]);

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    saleId: integer("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    repId: integer("rep_id")
      .notNull()
      .references(() => salesReps.id, { onDelete: "cascade" }),
    kind: approvalKindEnum("kind").notNull(),
    reason: text("reason").notNull(),
    payload: jsonb("payload"),
    status: approvalStatusEnum("status").notNull().default("pending"),
    decidedByRepId: integer("decided_by_rep_id").references(
      () => salesReps.id,
      { onDelete: "set null" },
    ),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("approval_requests_status_idx").on(t.status, t.createdAt),
    leadIdx: index("approval_requests_lead_idx").on(t.leadId),
    repIdx: index("approval_requests_rep_idx").on(t.repId, t.createdAt),
  }),
);

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
