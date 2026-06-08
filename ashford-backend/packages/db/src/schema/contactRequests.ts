import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";

export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "open",
  "claimed",
  "converted",
  "closed",
]);

export const preferredContactEnum = pgEnum("preferred_contact", [
  "callback",
  "sms",
  "email",
]);

export const contactRequests = pgTable("contact_requests", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  practice: varchar("practice", { length: 192 }),
  email: varchar("email", { length: 192 }),
  phone: varchar("phone", { length: 32 }),
  preferredContact: preferredContactEnum("preferred_contact")
    .notNull()
    .default("callback"),
  message: text("message"),
  bestTimeToReach: varchar("best_time_to_reach", { length: 96 }),
  // SMS opt-in audit trail. When `phone` is present and the submitter
  // ticked the consent checkbox we capture the verbatim disclosure
  // string they saw, when they accepted, and the request IP. These
  // four fields together are the defensible record we show to a TCR
  // reviewer.
  smsConsent: boolean("sms_consent").notNull().default(false),
  smsConsentText: text("sms_consent_text"),
  smsConsentAt: timestamp("sms_consent_at", { withTimezone: true }),
  ipAddress: varchar("ip_address", { length: 64 }),
  claimedByRepId: integer("claimed_by_rep_id").references(() => salesReps.id, {
    onDelete: "set null",
  }),
  status: contactRequestStatusEnum("status").notNull().default("open"),
  internalNote: text("internal_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ContactRequest = typeof contactRequests.$inferSelect;
