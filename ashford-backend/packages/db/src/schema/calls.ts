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
import { sql } from "drizzle-orm";
import { salesReps } from "./reps";
import { leads } from "./leads";

export const callDirectionEnum = pgEnum("call_direction", [
  "outbound",
  "inbound",
]);

// Mirrors Twilio's Call status strings verbatim.
// DialPad calls are normalized into this same set on ingest:
//   "hangup"|"answered"|"connected" -> "completed"
//   "missed"                        -> "no-answer"
// Anything we can't map falls through to "completed" so the call still shows
// up on the lead timeline rather than being silently dropped.
export const callStatusEnum = pgEnum("call_status", [
  "queued",
  "ringing",
  "in-progress",
  "completed",
  "no-answer",
  "busy",
  "failed",
  "canceled",
]);

// Voice provider that placed/answered the call. "twilio" is the existing
// click-to-call dialer + carrier inbound; "dialpad" is the rep's personal
// DialPad line auto-logged via webhook. Default "twilio" so historical
// rows back-fill correctly without a one-off UPDATE.
export const callProviderEnum = pgEnum("call_provider", ["twilio", "dialpad"]);

// One row per call attempt. costCents is integer cents (Twilio reports
// dollars as a negative float; we convert at write time).
export const calls = pgTable(
  "calls",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    repId: integer("rep_id").references(() => salesReps.id, {
      onDelete: "set null",
    }),
    direction: callDirectionEnum("direction").notNull(),
    fromNumber: varchar("from_number", { length: 32 }).notNull(),
    toNumber: varchar("to_number", { length: 32 }).notNull(),
    twilioCallSid: varchar("twilio_call_sid", { length: 64 }).unique(),
    // Vendor identifier from DialPad's Telephony API. Unique because we use
    // it as the natural key for upserts in the webhook handler — webhooks
    // re-fire (call.ended → call.recording.processed → call.transcript.processed
    // → call.summary.processed) and each must update the same row.
    dialpadCallId: varchar("dialpad_call_id", { length: 64 }).unique(),
    provider: callProviderEnum("provider").notNull().default("twilio"),
    status: callStatusEnum("status").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSec: integer("duration_sec"),
    costCents: integer("cost_cents").notNull().default(0),
    recordingObjectKey: text("recording_object_key"),
    voicemailObjectKey: text("voicemail_object_key"),
    recordingDurationSec: integer("recording_duration_sec"),
    voicemailDurationSec: integer("voicemail_duration_sec"),
    recordingUrl: text("recording_url"),
    voicemailUrl: text("voicemail_url"),
    recordingSid: varchar("recording_sid", { length: 64 }),
    voicemailSid: varchar("voicemail_sid", { length: 64 }),
    // Dedupe set: status-callback retries and child-leg callbacks both
    // re-post Price; tracking SIDs we've billed prevents double-counting.
    processedBillingSids: jsonb("processed_billing_sids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    leadIdx: index("calls_lead_idx").on(t.leadId),
    repIdx: index("calls_rep_idx").on(t.repId),
    sidIdx: index("calls_sid_idx").on(t.twilioCallSid),
    createdAtIdx: index("calls_created_at_idx").on(t.createdAt),
  }),
);

// Whisper transcript per call. Separate table so re-transcribes don't
// rewrite the call row and so cost is itemized for the daily cap.
export const callTranscripts = pgTable(
  "call_transcripts",
  {
    id: serial("id").primaryKey(),
    callId: integer("call_id")
      .notNull()
      .unique()
      .references(() => calls.id, { onDelete: "cascade" }),
    transcriptText: text("transcript_text").notNull(),
    transcriptLang: varchar("transcript_lang", { length: 8 }),
    whisperCostCents: integer("whisper_cost_cents").notNull().default(0),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    callIdx: index("call_transcripts_call_idx").on(t.callId),
  }),
);

// GPT-4o-mini summary of a transcript + lead context.
export const callSummaries = pgTable(
  "call_summaries",
  {
    id: serial("id").primaryKey(),
    callId: integer("call_id")
      .notNull()
      .unique()
      .references(() => calls.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    talkingPoints: jsonb("talking_points").$type<string[]>().notNull().default([]),
    nextActions: jsonb("next_actions").$type<string[]>().notNull().default([]),
    gptCostCents: integer("gpt_cost_cents").notNull().default(0),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    callIdx: index("call_summaries_call_idx").on(t.callId),
  }),
);

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;
export type CallTranscript = typeof callTranscripts.$inferSelect;
export type CallSummary = typeof callSummaries.$inferSelect;
