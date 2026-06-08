import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";
import { sales } from "./stripe";

export const customDevStatusEnum = pgEnum("custom_dev_status", [
  "requested",
  "quoted",
  "sent",
  "paid",
  "declined",
]);

export const customDevQuotes = pgTable("custom_dev_quotes", {
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
  featureKeys: jsonb("feature_keys").$type<string[]>().notNull().default([]),
  customDescription: text("custom_description"),
  status: customDevStatusEnum("status").notNull().default("requested"),
  quotedAmountCents: integer("quoted_amount_cents"),
  adminNote: text("admin_note"),
  stripePaymentLinkUrl: varchar("stripe_payment_link_url", { length: 256 }),
  stripePaymentLinkId: varchar("stripe_payment_link_id", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export type CustomDevQuote = typeof customDevQuotes.$inferSelect;
