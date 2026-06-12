import { Resend } from "resend";
import { env } from "../lib/env";
import { db, emailMessages } from "@workspace/db";
import { logger } from "../lib/logger";
import { wrapHtmlEmail, type EmailLocale } from "../services/emailLayout";

const client = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/** True when Resend has an API key configured. Surfaced via the dashboard
 * status endpoint so reps see a banner instead of silently-skipped emails. */
export const isResendConfigured = (): boolean => !!client;

export type SendEmailParams = {
  to: string;
  subject: string;
  body: string;
  fromRepFirstName?: string;
  fromRepDisplayName?: string;
  leadId?: number;
  repId?: number;
  /** Optional CTA button rendered inside the branded HTML envelope. */
  ctaUrl?: string;
  ctaLabel?: string;
  /** Locale switches the footer language and default CTA label. */
  locale?: EmailLocale;
  /**
   * Absolute URL of the hero image rendered above the body — typically the
   * cached screenshot served from `/api/preview-screenshot/:slug.png`. The
   * recipient's mail client fetches it directly; we don't ship the bytes
   * through Resend.
   */
  heroImageUrl?: string;
  heroImageCaption?: string;
  /**
   * Pre-rendered HTML body. When provided, the generic `wrapHtmlEmail`
   * envelope is skipped and `htmlOverride` is used verbatim. Used by the
   * 5-touch drip sequence whose per-touch designs are too distinct to fit the
   * shared envelope. The `body` field continues to drive the plain-text
   * fallback (set it to a sensible text version of the same message).
   */
  htmlOverride?: string;
  /**
   * When true, skip the branded `wrapHtmlEmail` envelope (logo, CTA button,
   * marketing footer, hero image) and send a minimal HTML body that looks
   * like a person typed it in Gmail. Used for 1:1 rep→prospect messages
   * sent from the lead page — the branded envelope was tripping Gmail's
   * Promotions-tab classifier on what should read as personal mail.
   */
  plain?: boolean;
};

/**
 * Minimal HTML wrapper used for plain rep-typed messages. No logo, no
 * footer, no CTA — just the body text with bare URLs auto-linked and a
 * sans-serif font that matches Gmail's native compose. Designed to look
 * like a regular person-to-person email so Gmail keeps it in Primary.
 */
const renderPlainHtml = (text: string): string => {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (m) => `<a href="${m}" style="color:#1a73e8;">${m}</a>`,
  );
  return `<div style="white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;color:#202124;">${linked}</div>`;
};

/**
 * Reduces a first name to an ASCII-safe email local-part. Strips diacritics
 * (Sofía → sofia), drops anything outside `[a-z0-9._-]`, and returns null if
 * nothing usable remains. Without this, names like "Sofía" or "Renée" would
 * produce non-ASCII local-parts that many SMTP relays reject outright.
 */
const sanitizeLocalPart = (name: string): string | null => {
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "");
  return ascii.length > 0 ? ascii : null;
};

// Build the "From" header.
//
// Rep-claimed leads use a first-name-only label, e.g.
//   "Sarah" <sarah@ashfordhealthcreative.com>
//
// Unclaimed-lead / generic sends use a clean Ashford identity instead of
// just "Ashford" — the caller passes "Ashford" as the first name on that
// path, so fall through to the generic envelope:
//   "Ashford Creative" <hello@ashfordhealthcreative.com>
const GENERIC_SENDER_LABEL = "Ashford Creative";

const buildFromAddress = (fromRepFirstName?: string): string => {
  const baseEmail = env.resendFromEmail ?? "hello@ashfordhealthcreative.com";
  const emailOnly = baseEmail.includes("<")
    ? baseEmail.replace(/.*<([^>]+)>.*/, "$1")
    : baseEmail;
  const domain = emailOnly.split("@")[1] ?? "ashfordhealthcreative.com";

  if (fromRepFirstName) {
    const safeLocal = sanitizeLocalPart(fromRepFirstName);
    // "Ashford" as a "first name" means the caller is the generic-sender
    // path — fall through to the clean envelope below.
    if (safeLocal && safeLocal !== "ashford") {
      return `"${fromRepFirstName}" <${safeLocal}@${domain}>`;
    }
  }
  return `"${GENERIC_SENDER_LABEL}" <${emailOnly}>`;
};

export const sendEmail = async (
  params: SendEmailParams,
): Promise<{ id: number; status: string; resendId: string | null }> => {
  // Spec sender format: `"Sarah" <sarah@ashfordhealthcreative.com>`.
  // The first name (when present) becomes both the alias label and the
  // local-part of the sender address. Existing callers historically pass
  // `fromRepFirstName` directly (it predates `fromRepDisplayName`); honor
  // that as the primary, with displayName's first token as the fallback,
  // so we don't silently downgrade those senders to the generic identity.
  const repFirstName =
    params.fromRepFirstName?.trim() ||
    params.fromRepDisplayName?.trim().split(/\s+/)[0];
  const from = buildFromAddress(repFirstName);
  const replyToTag = params.repId ? `+rep${params.repId}` : "";
  const replyTo = `reply${replyToTag}@${env.resendReplyDomain}`;
  const htmlBody = params.htmlOverride
    ? params.htmlOverride
    : params.plain
      ? renderPlainHtml(params.body)
      : wrapHtmlEmail({
          bodyText: params.body,
          ctaUrl: params.ctaUrl,
          ctaLabel: params.ctaLabel,
          locale: params.locale,
          heroImageUrl: params.heroImageUrl,
          heroImageCaption: params.heroImageCaption,
        });

  if (!client) {
    logger.warn(
      { to: params.to, subject: params.subject },
      "Resend not configured — persisting as dev_skipped",
    );
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject: params.subject,
        body: params.body,
        leadId: params.leadId,
        repId: params.repId,
        status: "dev_skipped",
      })
      .returning();
    return { id: row.id, status: "dev_skipped", resendId: null };
  }

  try {
    const result = await client.emails.send({
      from,
      to: params.to,
      replyTo,
      subject: params.subject,
      html: htmlBody,
      text: params.body,
    });
    if (result.error) throw new Error(result.error.message);
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject: params.subject,
        body: params.body,
        leadId: params.leadId,
        repId: params.repId,
        status: "sent",
        resendId: result.data?.id,
      })
      .returning();
    return { id: row.id, status: "sent", resendId: result.data?.id ?? null };
  } catch (err) {
    logger.error({ err }, "Resend send failed");
    const [row] = await db
      .insert(emailMessages)
      .values({
        direction: "outbound",
        fromAddr: from,
        toAddr: params.to,
        subject: params.subject,
        body: params.body,
        leadId: params.leadId,
        repId: params.repId,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .returning();
    return { id: row.id, status: "failed", resendId: null };
  }
};

