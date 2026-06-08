import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";
import { leads } from "./leads";

export const messageDirectionEnum = pgEnum("message_direction", [
  "outbound",
  "inbound",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "received",
  "dev_skipped",
]);

export const twilioMessages = pgTable(
  "twilio_messages",
  {
    id: serial("id").primaryKey(),
    direction: messageDirectionEnum("direction").notNull(),
    fromNumber: varchar("from_number", { length: 32 }).notNull(),
    toNumber: varchar("to_number", { length: 32 }).notNull(),
    body: text("body").notNull(),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    repId: integer("rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    status: messageStatusEnum("status").notNull().default("queued"),
    twilioSid: varchar("twilio_sid", { length: 128 }),
    errorMessage: text("error_message"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("twilio_messages_lead_idx").on(t.leadId),
    toIdx: index("twilio_messages_to_idx").on(t.toNumber),
  }),
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: serial("id").primaryKey(),
    direction: messageDirectionEnum("direction").notNull(),
    fromAddr: varchar("from_addr", { length: 192 }).notNull(),
    toAddr: varchar("to_addr", { length: 192 }).notNull(),
    subject: varchar("subject", { length: 256 }).notNull(),
    body: text("body").notNull(),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    repId: integer("rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    status: messageStatusEnum("status").notNull().default("queued"),
    resendId: varchar("resend_id", { length: 128 }),
    inReplyToId: varchar("in_reply_to_id", { length: 256 }),
    errorMessage: text("error_message"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("email_messages_lead_idx").on(t.leadId),
  }),
);

/**
 * Phone numbers that have explicitly opted out of receiving SMS from us. Set
 * by the inbound Twilio webhook when an inbound STOP / UNSUBSCRIBE / etc is
 * detected. The outbound `sendSms` helper checks this list before every send
 * and short-circuits if the number is present.
 *
 * Carriers (and the TCPA) require this list to be honored permanently, so we
 * do not currently expose any mechanism to remove rows here automatically.
 * If a customer asks to re-opt-in, an admin must remove the row by hand.
 */
export const smsOptOuts = pgTable(
  "sms_opt_outs",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 32 }).notNull().unique(),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: varchar("source", { length: 32 }).notNull().default("inbound_keyword"),
    keyword: varchar("keyword", { length: 32 }),
  },
  (t) => ({
    phoneIdx: index("sms_opt_outs_phone_idx").on(t.phone),
  }),
);

export type TwilioMessage = typeof twilioMessages.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type SmsOptOut = typeof smsOptOuts.$inferSelect;
