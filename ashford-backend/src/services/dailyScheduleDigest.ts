// CLEANUP C.1 — "Daily Schedule Digest" cron, scheduled at 7am Mon-Fri via
// node-cron. This is the seam for the upcoming calendar integration: once we
// wire up a real source (Google Calendar / Calendly / in-house bookings),
// `getTodaysAppointments()` is the single function to fill in. Today it
// returns `[]` so the cron is observable in prod logs but never sends an
// empty mail.
//
// The existing `frontDeskScheduleDigest` service mails today's *callback*
// schedule to front-desk recipients off the rep CRM; this one is the broader
// "what's on the books today" practitioner-side digest that will surface
// real client appointments once the calendar feed lands.
import cron, { type ScheduledTask } from "node-cron";
import { Resend } from "resend";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { db, articleSchedule, leads } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";

export type TodaysAppointment = {
  id: string;
  startAt: string; // ISO
  clientName: string;
  modality?: string; // e.g. "telehealth" | "in-person"
  note?: string;
};

// TODO(daily-schedule-digest): wire to calendar integration when available
// (Google Calendar / Calendly / in-house bookings table). The cron is wired
// and observable in prod; the data source is the only remaining piece.
export const getTodaysAppointments = async (
  _now: Date = new Date(),
): Promise<TodaysAppointment[]> => {
  return [];
};

const dayKeyLocal = (d: Date): string => d.toISOString().slice(0, 10);

const renderDigest = (
  items: TodaysAppointment[],
  label: string,
): { subject: string; text: string } => {
  const lines = [
    `Today's schedule — ${label}`,
    ``,
    `${items.length} appointment(s) on the books:`,
    ``,
  ];
  for (const a of items) {
    const t = new Date(a.startAt).toISOString().slice(11, 16);
    const modality = a.modality ? ` · ${a.modality}` : "";
    const note = a.note ? ` — ${a.note}` : "";
    lines.push(`  ${t} UTC  ${a.clientName}${modality}${note}`);
  }
  lines.push("", "Have a calm day.", "— Ashford");
  return {
    subject: `[Ashford] Today's schedule — ${label}`,
    text: lines.join("\n"),
  };
};

export const runDailyScheduleDigest = async (
  now: Date = new Date(),
): Promise<{ sent: boolean; reason?: string; label: string; count: number }> => {
  const label = dayKeyLocal(now);
  const items = await getTodaysAppointments(now);

  if (items.length === 0) {
    logger.info({ label }, "[daily-schedule-digest] no items — skipped");
    return { sent: false, reason: "no_items", label, count: 0 };
  }

  const toAddr = env.ownerNotificationEmail;
  if (!toAddr) {
    logger.info({ label }, "[daily-schedule-digest] no OWNER_NOTIFICATION_EMAIL — skipped");
    return { sent: false, reason: "no_recipient", label, count: items.length };
  }
  const fromAddr = env.resendFromEmail;
  const { subject, text } = renderDigest(items, label);

  if (!env.resendApiKey) {
    logger.info({ label, count: items.length }, "[daily-schedule-digest] dev-skipped (no RESEND_API_KEY)");
    return { sent: true, reason: "dev_skipped", label, count: items.length };
  }

  try {
    const resend = new Resend(env.resendApiKey);
    const result = await resend.emails.send({ from: fromAddr, to: toAddr, subject, text });
    if (result.error) throw new Error(result.error.message);
    logger.info({ label, count: items.length }, "[daily-schedule-digest] sent");
    return { sent: true, label, count: items.length };
  } catch (err) {
    logger.error({ err, label }, "[daily-schedule-digest] send failed");
    return { sent: false, reason: "send_error", label, count: items.length };
  }
};

// [CLEANUP D.6] Editorial reminders — separate 8am daily digest emailed to
// the editor when there are pending article_schedule rows whose due_date
// has arrived. Sentence-level prose, no AI/automation words.

type EditorialReminderRow = {
  scheduleId: number;
  leadId: number;
  leadName: string;
  specialty: string;
  topicHint: string | null;
  dueDate: string;
};

const todayYmd = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getDueEditorialItems = async (
  now: Date = new Date(),
): Promise<EditorialReminderRow[]> => {
  const today = todayYmd(now);
  const rows = await db
    .select({
      scheduleId: articleSchedule.id,
      leadId: articleSchedule.leadId,
      leadName: leads.name,
      specialty: leads.specialty,
      topicHint: articleSchedule.topicHint,
      dueDate: articleSchedule.dueDate,
    })
    .from(articleSchedule)
    .innerJoin(leads, eq(leads.id, articleSchedule.leadId))
    .where(
      and(
        eq(articleSchedule.status, "pending"),
        lte(articleSchedule.dueDate, today),
      ),
    )
    .orderBy(articleSchedule.dueDate);
  return rows;
};

const renderEditorialReminder = (
  items: EditorialReminderRow[],
  adminUrl: string,
): { subject: string; text: string } => {
  const lines = [
    `Articles to write today — ${items.length} on the queue.`,
    ``,
  ];
  for (const r of items) {
    const topic = r.topicHint ? ` — ${r.topicHint}` : "";
    lines.push(`  · ${r.leadName} (${r.specialty})${topic}  [due ${r.dueDate}]`);
  }
  lines.push("", `Open the queue: ${adminUrl}/admin/editorial`, "", "— Ashford");
  return {
    subject: `[Ashford] Editorial queue — ${items.length} article${items.length === 1 ? "" : "s"} to write today`,
    text: lines.join("\n"),
  };
};

export const runEditorialReminderDigest = async (
  now: Date = new Date(),
): Promise<{ sent: boolean; reason?: string; count: number }> => {
  const items = await getDueEditorialItems(now);
  if (items.length === 0) {
    logger.info("[editorial-reminder] nothing due — skipped");
    return { sent: false, reason: "no_items", count: 0 };
  }
  const toAddr = env.ownerNotificationEmail;
  if (!toAddr) {
    logger.info({ count: items.length }, "[editorial-reminder] no recipient — skipped");
    return { sent: false, reason: "no_recipient", count: items.length };
  }
  const fromAddr = env.resendFromEmail;
  const adminUrl =
    (env.publicBaseUrl ?? "").replace(/\/$/, "") || "https://ashfordcreative.org";
  const { subject, text } = renderEditorialReminder(items, adminUrl);
  if (!env.resendApiKey) {
    logger.info({ count: items.length }, "[editorial-reminder] dev-skipped (no RESEND_API_KEY)");
    return { sent: true, reason: "dev_skipped", count: items.length };
  }
  try {
    const resend = new Resend(env.resendApiKey);
    const result = await resend.emails.send({ from: fromAddr, to: toAddr, subject, text });
    if (result.error) throw new Error(result.error.message);
    logger.info({ count: items.length }, "[editorial-reminder] sent");
    return { sent: true, count: items.length };
  } catch (err) {
    logger.error({ err }, "[editorial-reminder] send failed");
    return { sent: false, reason: "send_error", count: items.length };
  }
};

let task: ScheduledTask | null = null;
let editorialTask: ScheduledTask | null = null;
const EDITORIAL_CRON_EXPR = "0 8 * * *";

// 7am Monday-Friday. node-cron schedules in the process timezone, which we
// leave at the host default (containers run UTC; cron string is the same in
// either case for this 5x/week digest).
const CRON_EXPR = "0 7 * * 1-5";

export const startDailyScheduleDigest = (): void => {
  if (!task) {
    task = cron.schedule(CRON_EXPR, () => {
      runDailyScheduleDigest().catch((err) =>
        logger.error({ err }, "[daily-schedule-digest] tick failed"),
      );
    });
    logger.info({ cron: CRON_EXPR }, "[daily-schedule-digest] scheduled");
  }
  if (!editorialTask) {
    editorialTask = cron.schedule(EDITORIAL_CRON_EXPR, () => {
      runEditorialReminderDigest().catch((err) =>
        logger.error({ err }, "[editorial-reminder] tick failed"),
      );
    });
    logger.info({ cron: EDITORIAL_CRON_EXPR }, "[editorial-reminder] scheduled");
  }
};

export const stopDailyScheduleDigest = (): void => {
  if (task) {
    task.stop();
    task = null;
  }
  if (editorialTask) {
    editorialTask.stop();
    editorialTask = null;
  }
};
