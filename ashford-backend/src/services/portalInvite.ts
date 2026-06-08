import { sendSms } from "../integrations/dialpad";
import { sendEmail } from "../integrations/resend";
import { createShortLink, getOrCreateShortLink } from "./shortLinks";
import {
  ensurePortalForLead,
  markInviteSent,
  recordPortalEvent,
} from "./portals";
import { renderDripEmail } from "./dripEmailRenderer";
import {
  buildPortalScreenshotUrl,
  warmPortalScreenshot,
} from "./templateScreenshot";
import { wrapHtmlEmail } from "./emailLayout";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

const firstName = (full: string | null | undefined) => {
  const t = full?.trim();
  return t ? t.split(/\s+/)[0]! : "there";
};

export type InviteLead = {
  id: number;
  name: string;
  practice: string;
  phone: string | null;
  email: string | null;
  locale: string | null;
};

export type InviteChannels = { sms: boolean; email: boolean };

export type InviteResult = {
  url: string;
  longUrl: string;
  slug: string;
  sms: { id: number; status: string; sid: string | null } | { error: string } | null;
  email: { id: number; status: string; resendId: string | null } | { error: string } | null;
  smsStatus: string;
  emailStatus: string;
  deduped?: boolean;
};

// `failed`/`opted_out` resolve as fulfilled promises but must NOT count
// as successful sends or the J+3/J+8 timers fire on a silent miss.
const SUCCESS_STATUSES = new Set(["sent", "queued", "accepted", "dev_skipped"]);
const isTransportSuccess = (
  v: { status: string } | null | undefined,
): boolean => !!v && SUCCESS_STATUSES.has(v.status);

/**
 * Cool-down window for accidental re-sends (rep double-clicks the button,
 * a flaky network triggers a request retry, an admin opens the same lead
 * in two tabs). Within this window we short-circuit the send and return a
 * `deduped: true` result reusing the existing short URL.
 *
 * 60 seconds is wide enough to swallow real-world double-click bursts but
 * narrow enough that an intentional re-send (e.g. corrected phone number)
 * still works without an admin-only override.
 *
 * Note this is a soft guard: two requests racing within the same tick can
 * still both pass the check and reach Twilio/Resend. The rate-limit
 * middleware on the route (30 burst / 0.2 refill) catches the immediate
 * burst case; this guard catches the 1-60s window where the rate limit
 * has refilled enough to let the second request through.
 */
const INVITE_DEDUPE_WINDOW_MS = 60 * 1000;

export type PortalInviteDraft = {
  subject: string;
  textBody: string;
  smsBody: string;
  shortUrl: string;
  longUrl: string;
  slug: string;
};

/**
 * Render the day-1 portal-invite content without sending or marking the
 * invite as sent. Mints the portal (idempotent per lead) and a short link
 * (idempotent per lead+purpose+target) so the URL the rep previews matches
 * what the recipient will receive. No screenshot warm — the modal preview
 * is text-only; the styled HTML hero is composed at send time.
 */
export async function renderPortalInviteDraft(params: {
  repDisplayName: string;
  lead: InviteLead;
}): Promise<PortalInviteDraft> {
  const { repDisplayName, lead } = params;
  const portal = await ensurePortalForLead(lead.id);
  const longUrl = `${env.publicBaseUrl}/preview/${portal.slug}?t=${encodeURIComponent(portal.accessToken)}`;
  const { url: shortUrl } = await getOrCreateShortLink(longUrl, {
    leadId: lead.id,
    purpose: "portal_invite",
  });
  const repFirst = repDisplayName ? firstName(repDisplayName) : "Ashford Creative";
  const leadFirst = firstName(lead.name);
  const locale: "en" | "es" = lead.locale === "es" ? "es" : "en";
  const smsBody =
    locale === "es"
      ? `${leadFirst}, soy ${repFirst} de Ashford Creative. Tu vista previa personalizada: ${shortUrl}. Responde STOP para cancelar.`
      : `${leadFirst}, it's ${repFirst} from Ashford Creative. Your custom site preview: ${shortUrl}. Reply STOP to opt out.`;
  const drip = renderDripEmail({
    touch: "day1",
    leadFirstName: leadFirst,
    practice: lead.practice,
    repFirstName: repFirst,
    repFullName: repDisplayName ?? "Ashford Creative",
    locale,
    ctaUrl: shortUrl,
  });
  return {
    subject: drip.subject,
    textBody: drip.textBody,
    smsBody,
    shortUrl,
    longUrl,
    slug: portal.slug,
  };
}

export async function sendPortalInvite(params: {
  repId: number;
  repDisplayName: string;
  lead: InviteLead;
  channels?: InviteChannels;
  /**
   * If provided, the rep edited the rendered email in the preview modal
   * before sending. We send the edited subject/textBody verbatim and build
   * the HTML body with the generic branded wrapper (`wrapHtmlEmail`) rather
   * than the day-1 drip layout, so what the rep saw is exactly what ships.
   */
  subjectOverride?: string;
  textBodyOverride?: string;
  /** Same idea for the SMS body. */
  smsBodyOverride?: string;
}): Promise<InviteResult> {
  const { repId, repDisplayName, lead } = params;
  const channels: InviteChannels = params.channels ?? { sms: true, email: true };
  const portal = await ensurePortalForLead(lead.id);

  const longUrl = `${env.publicBaseUrl}/preview/${portal.slug}?t=${encodeURIComponent(portal.accessToken)}`;

  // Dedupe guard: if we already marked the invite as sent within the last
  // INVITE_DEDUPE_WINDOW_MS, do not re-send. Mint a fresh short link so the
  // caller can still surface the URL (the prior one is also still valid),
  // and report `deduped: true` so the UI can soften the toast copy.
  if (
    portal.inviteSentAt &&
    Date.now() - portal.inviteSentAt.getTime() < INVITE_DEDUPE_WINDOW_MS
  ) {
    logger.info(
      {
        leadId: lead.id,
        portalId: portal.id,
        inviteSentAt: portal.inviteSentAt,
      },
      "send-invite: dedupe window hit, skipping send",
    );
    const { url: shortUrl } = await createShortLink(longUrl, {
      leadId: lead.id,
      purpose: "portal_invite",
    });
    return {
      url: shortUrl,
      longUrl,
      slug: portal.slug,
      sms: null,
      email: null,
      smsStatus: "skipped_dedupe",
      emailStatus: "skipped_dedupe",
      deduped: true,
    };
  }

  // Idempotent per (leadId, purpose, targetUrl) so the URL the rep
  // previewed in the modal draft step is the same one we ship here.
  const { url: shortUrl } = await getOrCreateShortLink(longUrl, {
    leadId: lead.id,
    purpose: "portal_invite",
  });

  const repFirst = repDisplayName ? firstName(repDisplayName) : "Ashford Creative";
  const leadFirst = firstName(lead.name);
  const locale: "en" | "es" = lead.locale === "es" ? "es" : "en";

  const smsBody =
    params.smsBodyOverride?.trim() ||
    (locale === "es"
      ? `${leadFirst}, soy ${repFirst} de Ashford Creative. Tu vista previa personalizada: ${shortUrl}. Responde STOP para cancelar.`
      : `${leadFirst}, it's ${repFirst} from Ashford Creative. Your custom site preview: ${shortUrl}. Reply STOP to opt out.`);

  // Day-1 touch of the 5-step cold drip — the rest of the sequence
  // (D+3, D+7, D+14, D+30) is delivered by `reengagement.ts`. Using the same
  // per-touch HTML renderer here keeps the visual story consistent: the
  // first thing the prospect ever sees from us already looks like the rest
  // of the sequence.
  //
  // Hero = screenshot of the prospect's OWN customized portal page.
  //
  // We BLOCK up to ~10s waiting for the cache to warm before sending. This
  // matters because Gmail (and other webmail clients) proxy remote images
  // through their own fetcher, which gives up on a cold capture and caches
  // the broken result for the recipient's session. Pre-warming the cache
  // means the proxy gets an instant response and the prospect actually
  // sees the hero image. If the warm-up times out we still send the email
  // (no regression vs. the prior fire-and-forget behaviour) and the
  // capture finishes in the background for the next touch.
  //
  // Gate the warm-up on `willSendEmail` — there's no point eating the
  // ~10s capture latency on an SMS-only invite where no mail client will
  // ever fetch the image. (Computed up here so we can branch on it.)
  const willSendSms = channels.sms && !!lead.phone;
  const willSendEmail = channels.email && !!lead.email;

  // Hero strategy (#224 architect review 2026-05): bound rep-facing
  // latency to ≤ 3s by racing the warm-up against a hard 3s budget. If
  // the warm doesn't beat the budget we OMIT `heroImageUrl` from the
  // email entirely so the renderer falls back to its no-image / CSS
  // hero path instead of shipping a `<img src=...>` tag pointing at a
  // not-yet-cached screenshot (which Gmail's image proxy fetches once,
  // gives up on, and then caches the failure for the recipient's
  // session). The capture continues in the background so subsequent
  // touches and re-opens benefit from the warmed cache.
  let heroImageUrl: string | undefined;
  if (willSendEmail) {
    const heroWarmedAt = Date.now();
    const HERO_WARM_BUDGET_MS = 3_000;
    // Kick off the long-running warm; do NOT await beyond the budget.
    const warmPromise = warmPortalScreenshot(
      portal.slug,
      portal.accessToken,
    );
    const winner = await Promise.race([
      warmPromise,
      new Promise<"budget">((r) =>
        setTimeout(() => r("budget"), HERO_WARM_BUDGET_MS),
      ),
    ]);
    if (winner === true) {
      heroImageUrl = buildPortalScreenshotUrl(
        portal.slug,
        portal.accessToken,
      );
    } else {
      logger.warn(
        {
          slug: portal.slug,
          leadId: portal.leadId,
          elapsedMs: Date.now() - heroWarmedAt,
          reason: winner === "budget" ? "budget_exceeded" : "warm_failed",
        },
        "portal-invite: hero screenshot not ready inside 3s budget — shipping email with CSS hero fallback (no <img>)",
      );
      // Let the warm finish in the background so the cache populates
      // for the next touch / opener.
      void warmPromise.catch(() => undefined);
    }
  }

  // When the rep edited the email in the preview modal, ship those edits
  // verbatim via the generic branded wrapper rather than the day-1 drip
  // layout — the drip renderer hard-codes the body copy from its template
  // and can't accept arbitrary prose. Subject/text fall back to the drip
  // render when not overridden so partial edits still work.
  const hasEmailOverride =
    !!params.subjectOverride?.trim() || !!params.textBodyOverride?.trim();
  const drip = hasEmailOverride
    ? null
    : renderDripEmail({
        touch: "day1",
        leadFirstName: leadFirst,
        practice: lead.practice,
        repFirstName: repFirst,
        repFullName: repDisplayName ?? "Ashford Creative",
        locale,
        ctaUrl: shortUrl,
        heroImageUrl,
      });
  const emailSubject =
    params.subjectOverride?.trim() ||
    drip?.subject ||
    (locale === "es"
      ? `Tu vista previa personalizada — Ashford Creative`
      : `Your custom site preview — Ashford Creative`);
  const emailTextBody =
    params.textBodyOverride?.trim() || drip?.textBody || "";
  const emailHtmlBody =
    drip?.htmlBody ??
    wrapHtmlEmail({
      bodyText: emailTextBody,
      ctaUrl: shortUrl,
      locale,
      heroImageUrl,
    });

  const [smsResult, emailResult] = await Promise.allSettled([
    willSendSms
      ? sendSms({ to: lead.phone!, body: smsBody, leadId: lead.id, repId })
      : Promise.resolve(null),
    willSendEmail
      ? sendEmail({
          to: lead.email!,
          subject: emailSubject,
          body: emailTextBody,
          htmlOverride: emailHtmlBody,
          leadId: lead.id,
          repId,
          fromRepDisplayName: repDisplayName,
          locale,
        })
      : Promise.resolve(null),
  ]);

  const smsValue = smsResult.status === "fulfilled" ? smsResult.value : null;
  const emailValue = emailResult.status === "fulfilled" ? emailResult.value : null;
  const smsOk = isTransportSuccess(smsValue);
  const emailOk = isTransportSuccess(emailValue);

  if (smsOk || emailOk) {
    await markInviteSent(portal.id);
    await recordPortalEvent(portal.slug, {
      eventType: "invite_sent",
      metadata: {
        sms: smsOk ? "ok" : willSendSms ? "failed" : "skipped",
        email: emailOk ? "ok" : willSendEmail ? "failed" : "skipped",
      },
    });
  } else {
    logger.warn(
      {
        leadId: lead.id,
        portalId: portal.id,
        smsStatus: smsValue?.status ?? null,
        emailStatus: emailValue?.status ?? null,
      },
      "send-invite: no channel succeeded",
    );
  }

  const sms =
    smsResult.status === "fulfilled"
      ? smsResult.value
      : { error: String(smsResult.reason) };
  const email =
    emailResult.status === "fulfilled"
      ? emailResult.value
      : { error: String(emailResult.reason) };

  const smsStatus = !channels.sms
    ? "skipped_unselected"
    : !lead.phone
      ? "skipped_no_phone"
      : smsResult.status === "fulfilled"
        ? (smsResult.value?.status ?? "sent")
        : "failed";
  const emailStatus = !channels.email
    ? "skipped_unselected"
    : !lead.email
      ? "skipped_no_email"
      : emailResult.status === "fulfilled"
        ? (emailResult.value?.status ?? "sent")
        : "failed";

  return {
    url: shortUrl,
    longUrl,
    slug: portal.slug,
    sms,
    email,
    smsStatus,
    emailStatus,
  };
}
