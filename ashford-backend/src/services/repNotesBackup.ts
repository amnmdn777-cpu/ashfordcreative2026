/**
 * #230 protection layer 2/3 — hourly external backup of lead_rep_notes.
 *
 * The DB trigger (migration 0022) handles in-database mishaps: any DELETE
 * is archived. But it doesn't help against the actual 2026-05-13 incident
 * scenario: the entire Neon project was recreated, taking the archive
 * table with it. This worker is the parachute against THAT class of
 * failure — it runs hourly, dumps the current contents of lead_rep_notes
 * as CSV, and emails it via Resend to OWNER_NOTIFICATION_EMAIL.
 *
 * Design choices:
 *   - Idempotent and stateless. No DB writes from this worker.
 *   - Skips the send if Resend isn't configured (dev) or if there are
 *     zero notes (don't spam the founder's inbox while seeding).
 *   - Skips the send if the hourly hash equals the previous hour's (no
 *     changes since last backup → no email). Hash is held in memory
 *     so it resets on each server restart, which produces at most one
 *     redundant email after a deploy — acceptable.
 *   - Emails are sent to OWNER_NOTIFICATION_EMAIL specifically so a
 *     mistake on the rep accounts can never block delivery.
 *   - CSV is attached, not inline — keeps the body short and readable
 *     in the inbox preview.
 */

import { db, leadRepNotes } from "@workspace/db";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { desc } from "drizzle-orm";

const require = createRequire(import.meta.url);

// Lazy-load resend so dev environments without a key don't pay the import.
let resendClient: { emails: { send: (args: object) => Promise<{ error?: { message: string } | null }> } } | null = null;
const getResend = () => {
  if (resendClient || !env.resendApiKey) return resendClient;
  const { Resend } = require("resend");
  resendClient = new Resend(env.resendApiKey);
  return resendClient;
};

let lastHash: string | null = null;

const csvEscape = (s: string): string => {
  if (s == null) return "";
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const buildCsv = (rows: Array<{ id: number; leadId: number; authorRepId: number | null; body: string; createdAt: Date }>): string => {
  const header = "id,lead_id,author_rep_id,created_at,body";
  const lines = rows.map((r) =>
    [
      r.id,
      r.leadId,
      r.authorRepId ?? "",
      r.createdAt.toISOString(),
      csvEscape(r.body),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
};

export const backupRepNotesNow = async (): Promise<{ sent: boolean; reason: string; count: number }> => {
  const rows = await db
    .select({
      id: leadRepNotes.id,
      leadId: leadRepNotes.leadId,
      authorRepId: leadRepNotes.authorRepId,
      body: leadRepNotes.body,
      createdAt: leadRepNotes.createdAt,
    })
    .from(leadRepNotes)
    .orderBy(desc(leadRepNotes.createdAt));

  if (rows.length === 0) {
    return { sent: false, reason: "empty_table", count: 0 };
  }

  const csv = buildCsv(rows);
  const hash = crypto.createHash("sha256").update(csv).digest("hex");
  if (hash === lastHash) {
    return { sent: false, reason: "no_changes_since_last_backup", count: rows.length };
  }

  const owner = env.ownerNotificationEmail;
  if (!owner) {
    return { sent: false, reason: "no_owner_email_configured", count: rows.length };
  }

  const client = getResend();
  if (!client) {
    return { sent: false, reason: "resend_not_configured", count: rows.length };
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const filename = `lead_rep_notes_${stamp}.csv`;

  const summary = rows.slice(0, 5).map((r) => `  lead#${r.leadId}  ${r.createdAt.toISOString()}  ${r.body.slice(0, 60).replace(/\n/g, " ")}`).join("\n");
  const body = [
    `Hourly snapshot of lead_rep_notes (${rows.length} row${rows.length === 1 ? "" : "s"}).`,
    `Generated at ${now.toISOString()}.`,
    "",
    "Most recent 5 entries:",
    summary,
    "",
    "If a wipe ever recurs, this attachment is your last-resort restore.",
    "(#230 protection layer 2/3)",
  ].join("\n");

  try {
    const result = await client.emails.send({
      from: `Ashford Backup <backup@${env.resendReplyDomain}>`,
      to: owner,
      subject: `[Ashford backup] lead_rep_notes — ${rows.length} rows — ${stamp}`,
      text: body,
      attachments: [
        {
          filename,
          content: Buffer.from(csv, "utf8").toString("base64"),
        },
      ],
    });
    if (result.error) {
      logger.error({ err: result.error }, "repNotesBackup: resend error");
      return { sent: false, reason: `resend_error: ${result.error.message}`, count: rows.length };
    }
    lastHash = hash;
    logger.info({ count: rows.length, filename }, "repNotesBackup: sent");
    return { sent: true, reason: "ok", count: rows.length };
  } catch (e) {
    logger.error({ err: e }, "repNotesBackup: send threw");
    return { sent: false, reason: `exception: ${(e as Error).message}`, count: rows.length };
  }
};
