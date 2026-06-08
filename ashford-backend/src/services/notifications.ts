import { db, notifications } from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { env } from "../lib/env";
import { sendSms } from "../integrations/dialpad";
import { logger } from "../lib/logger";
import { Resend } from "resend";

export const notify = async (params: {
  repId: number;
  type: string;
  title: string;
  body?: string;
  payload?: unknown;
  linkUrl?: string;
}) => {
  const [row] = await db
    .insert(notifications)
    .values({
      repId: params.repId,
      type: params.type,
      title: params.title,
      body: params.body,
      payload: params.payload as Record<string, unknown> | undefined,
      linkUrl: params.linkUrl,
    })
    .returning();
  return row;
};

export const listNotifications = (repId: number, unreadOnly = false) => {
  const conds = [eq(notifications.repId, repId)];
  if (unreadOnly) conds.push(isNull(notifications.readAt));
  return db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
};

export const markRead = (repId: number, id: number) =>
  db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.repId, repId)));

export const markAllRead = (repId: number) =>
  db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.repId, repId), isNull(notifications.readAt)));

// ---------------------------------------------------------------------------
// Owner notification fan-out
// ---------------------------------------------------------------------------
//
// On a curated set of high-signal events (sale.won, subscription.past_due,
// client_onboarding.ready_to_build, custom_dev.quote_requested,
// approval.requested, escalation.opened) we also fan out to the owner via
// email + SMS. Configuration is via env vars (no UI):
//
//   OWNER_NOTIFICATION_EMAIL    — single destination address (optional)
//   OWNER_NOTIFICATION_SMS      — single E.164 destination phone (optional)
//   OWNER_NOTIFICATION_TYPES    — comma-separated allowlist of event types
//
// The fan-out is best-effort: failures are logged and never thrown so the
// originating webhook / business action stays atomic.

export const notifyOwner = async (params: {
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
}): Promise<void> => {
  if (!env.ownerNotificationTypes.includes(params.type)) return;

  const absoluteLink = params.linkUrl
    ? params.linkUrl.startsWith("http")
      ? params.linkUrl
      : `${env.publicBaseUrl}${params.linkUrl.startsWith("/") ? "" : "/"}${params.linkUrl}`
    : undefined;

  const subjectPrefix = `[Ashford] ${params.type}`;

  // Email via Resend
  if (env.ownerNotificationEmail) {
    if (!env.resendApiKey) {
      logger.info(
        { type: params.type, to: env.ownerNotificationEmail },
        "[owner-notify] dev-skipped email (no RESEND_API_KEY)",
      );
    } else {
      try {
        const resend = new Resend(env.resendApiKey);
        const text = [
          params.title,
          params.body ?? "",
          absoluteLink ? `\n${absoluteLink}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        await resend.emails.send({
          from: env.resendFromEmail,
          to: env.ownerNotificationEmail,
          subject: `${subjectPrefix} — ${params.title}`.slice(0, 160),
          text,
        });
      } catch (err) {
        logger.error({ err, type: params.type }, "[owner-notify] email failed");
      }
    }
  }

  // SMS via Twilio
  if (env.ownerNotificationSms) {
    try {
      const smsBody = [params.title, params.body ?? "", absoluteLink ?? ""]
        .filter(Boolean)
        .join("\n")
        .slice(0, 600);
      await sendSms({ to: env.ownerNotificationSms, body: smsBody });
    } catch (err) {
      logger.error({ err, type: params.type }, "[owner-notify] sms failed");
    }
  }
};
