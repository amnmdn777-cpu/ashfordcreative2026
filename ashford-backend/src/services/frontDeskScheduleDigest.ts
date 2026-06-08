import { Resend } from "resend";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, callbackSchedules, leads, emailMessages } from "@workspace/db";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

const dayKeyUtc = (d: Date): string => d.toISOString().slice(0, 10);

const todayWindowUtc = (now: Date) => {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, label: dayKeyUtc(start) };
};

const sentinelFor = (label: string, recipient: string): string =>
  `front_desk_schedule_digest:${label}:${recipient}`;

export const buildScheduleSummary = async (now: Date = new Date()) => {
  const { start, end, label } = todayWindowUtc(now);
  const rows = await db
    .select({
      id: callbackSchedules.id,
      scheduledFor: callbackSchedules.scheduledFor,
      note: callbackSchedules.note,
      leadName: leads.name,
      practice: leads.practice,
      phone: leads.phone,
    })
    .from(callbackSchedules)
    .leftJoin(leads, eq(leads.id, callbackSchedules.leadId))
    .where(
      and(
        gte(callbackSchedules.scheduledFor, start),
        lt(callbackSchedules.scheduledFor, end),
      ),
    )
    .orderBy(callbackSchedules.scheduledFor);
  return { label, items: rows };
};

export const renderScheduleDigest = (
  s: Awaited<ReturnType<typeof buildScheduleSummary>>,
): { subject: string; text: string } => {
  const lines = [
    `Front-desk schedule digest — ${s.label} (UTC)`,
    ``,
    `${s.items.length} appointment(s) on the books today:`,
    ``,
  ];
  if (s.items.length === 0) {
    lines.push("  (no appointments scheduled)");
  } else {
    for (const it of s.items) {
      const t = it.scheduledFor
        ? new Date(it.scheduledFor).toISOString().slice(11, 16)
        : "??:??";
      const who = it.practice || it.leadName || `Lead #${it.id}`;
      const phone = it.phone ? ` · ${it.phone}` : "";
      const note = it.note ? ` — ${it.note}` : "";
      lines.push(`  ${t} UTC  ${who}${phone}${note}`);
    }
  }
  lines.push("", "Have a calm day.", "— Ashford");
  return {
    subject: `[Ashford] Today's schedule — ${s.label}`,
    text: lines.join("\n"),
  };
};

export const sendFrontDeskScheduleDigestIfDue = async (
  now: Date = new Date(),
): Promise<{ sent: number; reason?: string; label?: string }> => {
  if (!env.frontDeskScheduleDigestEnabled)
    return { sent: 0, reason: "disabled" };
  if (env.frontDeskScheduleDigestRecipients.length === 0)
    return { sent: 0, reason: "no_recipients" };
  if (now.getUTCHours() < env.frontDeskScheduleDigestHourUtc)
    return { sent: 0, reason: "not_yet" };

  const summary = await buildScheduleSummary(now);
  const { subject, text } = renderScheduleDigest(summary);
  const fromAddr = env.resendFromEmail;
  let sent = 0;

  for (const toAddr of env.frontDeskScheduleDigestRecipients) {
    const sentinel = sentinelFor(summary.label, toAddr);
    const existing = await db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(eq(emailMessages.inReplyToId, sentinel))
      .limit(1);
    if (existing.length > 0) continue;

    if (!env.resendApiKey) {
      logger.info(
        { label: summary.label, toAddr },
        "[front-desk-digest] dev-skipped (no RESEND_API_KEY)",
      );
      await db.insert(emailMessages).values({
        direction: "outbound",
        fromAddr,
        toAddr,
        subject,
        body: text,
        status: "dev_skipped",
        inReplyToId: sentinel,
      });
      sent++;
      continue;
    }
    try {
      const resend = new Resend(env.resendApiKey);
      const result = await resend.emails.send({
        from: fromAddr,
        to: toAddr,
        subject,
        text,
      });
      if (result.error) throw new Error(result.error.message);
      await db.insert(emailMessages).values({
        direction: "outbound",
        fromAddr,
        toAddr,
        subject,
        body: text,
        status: "sent",
        resendId: result.data?.id,
        inReplyToId: sentinel,
      });
      logger.info({ label: summary.label, toAddr }, "[front-desk-digest] sent");
      sent++;
    } catch (err) {
      logger.error(
        { err, label: summary.label, toAddr },
        "[front-desk-digest] send failed",
      );
    }
  }
  return { sent, label: summary.label };
};
