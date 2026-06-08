// "Daily Schedule Digest" backend job — Catalog 2.0 default feature.
// Renders the front-desk-facing summary of yesterday's sales, lead funnel,
// dunning, stale work, and pending approvals; sent once per UTC day after
// env.ownerDailyDigestHourUtc. Scheduler wiring lives in app.ts (5min tick).
import { db, sales, leads, prospectLinks, linkEvents, emailMessages, approvalRequests } from "@workspace/db";
import { and, eq, gte, lt, sql, isNotNull, lte } from "drizzle-orm";
import { Resend } from "resend";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

const digestSentinel = (dateKey: string) => `owner_daily_digest:${dateKey}`;

const dayKeyUtc = (d: Date): string => d.toISOString().slice(0, 10);

const yesterdayWindowUtc = (
  now: Date,
): { start: Date; end: Date; label: string } => {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end, label: dayKeyUtc(start) };
};

export const buildDigestSummary = async (now: Date = new Date()) => {
  const { start, end, label } = yesterdayWindowUtc(now);

  const [salesAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${sales.setupAmountCents} + ${sales.monthlyAmountCents}), 0)::int`,
    })
    .from(sales)
    .where(and(gte(sales.occurredAt, start), lt(sales.occurredAt, end)));

  const [claimedAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        isNotNull(leads.claimedAt),
        gte(leads.claimedAt, start),
        lt(leads.claimedAt, end),
      ),
    );

  const [disqAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.status, "disqualified"),
        isNotNull(leads.lastActivityAt),
        gte(leads.lastActivityAt, start),
        lt(leads.lastActivityAt, end),
      ),
    );

  // Preview links = prospect_links rows created (these carry the
  // template-comparison preview that reps text/email to leads).
  const [previewLinkAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(prospectLinks)
    .where(and(gte(prospectLinks.createdAt, start), lt(prospectLinks.createdAt, end)));

  // Payment links = link_events rows of type payment_link_sent (logged when
  // a rep generates a Stripe payment link from inside a lead's preview).
  const [paymentLinkAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(linkEvents)
    .where(
      and(
        eq(linkEvents.eventType, "payment_link_sent"),
        gte(linkEvents.occurredAt, start),
        lt(linkEvents.occurredAt, end),
      ),
    );

  // Dunning events: count payment_failed-flavoured outbound emails sent yesterday
  const [dunningAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailMessages)
    .where(
      and(
        gte(emailMessages.occurredAt, start),
        lt(emailMessages.occurredAt, end),
        sql`${emailMessages.inReplyToId} like 'payment_failed:%'`,
      ),
    );

  // Stale: claimed leads with no activity for >7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [staleAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        isNotNull(leads.claimedAt),
        eq(leads.status, "claimed"),
        lte(leads.lastActivityAt, sevenDaysAgo),
      ),
    );

  const [pendingAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(approvalRequests)
    .where(eq(approvalRequests.status, "pending"));

  // Up to 10 stalest leads, oldest activity first, for direct mention in
  // the digest body so the owner can reach in by name rather than just a count.
  const staleLeadList = await db
    .select({
      id: leads.id,
      name: leads.name,
      practice: leads.practice,
      lastActivityAt: leads.lastActivityAt,
    })
    .from(leads)
    .where(
      and(
        isNotNull(leads.claimedAt),
        eq(leads.status, "claimed"),
        lte(leads.lastActivityAt, sevenDaysAgo),
      ),
    )
    .orderBy(leads.lastActivityAt)
    .limit(10);

  return {
    label,
    sales: { count: salesAgg.count, totalCents: salesAgg.totalCents },
    leadsClaimed: claimedAgg.count,
    leadsDisqualified: disqAgg.count,
    previewLinksSent: previewLinkAgg.count,
    paymentLinksSent: paymentLinkAgg.count,
    dunningEvents: dunningAgg.count,
    staleClaimed: staleAgg.count,
    staleClaimedSample: staleLeadList,
    pendingApprovals: pendingAgg.count,
  };
};

export const renderDigestEmail = (
  s: Awaited<ReturnType<typeof buildDigestSummary>>,
): { subject: string; text: string } => {
  const dollars = (c: number) => `$${(c / 100).toFixed(0)}`;
  const lines = [
    `Ashford daily digest — ${s.label} (UTC)`,
    ``,
    `SALES`,
    `  ${s.sales.count} new sale(s) — ${dollars(s.sales.totalCents)} total (setup + first month)`,
    ``,
    `LEAD FUNNEL`,
    `  ${s.leadsClaimed} leads claimed`,
    `  ${s.leadsDisqualified} leads disqualified`,
    `  ${s.previewLinksSent} preview link(s) sent`,
    `  ${s.paymentLinksSent} payment link(s) sent`,
    ``,
    `OPERATIONS`,
    `  ${s.dunningEvents} dunning email(s) sent (payment failures)`,
    `  ${s.staleClaimed} claimed lead(s) stale > 7 days`,
    ...(s.staleClaimedSample.length
      ? s.staleClaimedSample.map((l) => {
          const ageDays = l.lastActivityAt
            ? Math.floor(
                (Date.now() - new Date(l.lastActivityAt).getTime()) /
                  (24 * 60 * 60 * 1000),
              )
            : null;
          const label = l.practice || l.name || `Lead #${l.id}`;
          return `      • ${label} (#${l.id})${ageDays != null ? ` — ${ageDays}d quiet` : ""}`;
        })
      : []),
    `  ${s.pendingApprovals} approval request(s) currently pending`,
    ``,
    `${env.publicBaseUrl}/ashford-admin/`,
  ];
  return {
    subject: `[Ashford] Daily digest — ${s.label}`,
    text: lines.join("\n"),
  };
};

export const sendDailyDigestIfDue = async (
  now: Date = new Date(),
): Promise<{ sent: boolean; reason?: string; label?: string }> => {
  if (!env.ownerDailyDigestEnabled)
    return { sent: false, reason: "disabled" };
  if (!env.ownerNotificationEmail)
    return { sent: false, reason: "no_owner_email" };
  if (now.getUTCHours() < env.ownerDailyDigestHourUtc)
    return { sent: false, reason: "not_yet" };

  const summary = await buildDigestSummary(now);
  const sentinel = digestSentinel(summary.label);

  // Race-safe idempotency: serialize concurrent runners on a Postgres
  // advisory lock keyed off the date. Whichever caller arrives first wins
  // the lock, performs the read+send+insert, then releases. Other callers
  // block briefly, then re-check the sentinel and bail.
  const lockKey = (() => {
    let h = 5381;
    for (let i = 0; i < summary.label.length; i++)
      h = ((h << 5) + h + summary.label.charCodeAt(i)) | 0;
    return h;
  })();
  const lockOk = await db.execute(
    sql`select pg_try_advisory_lock(${lockKey}) as ok`,
  );
  const acquired = (lockOk as unknown as { rows: { ok: boolean }[] }).rows?.[0]?.ok;
  if (!acquired) return { sent: false, reason: "locked", label: summary.label };

  try {
    // Idempotency: did we already send today's digest?
    const existing = await db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(eq(emailMessages.inReplyToId, sentinel))
      .limit(1);
    if (existing.length > 0)
      return { sent: false, reason: "already_sent", label: summary.label };
    return await performDigestSend({ summary, sentinel });
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${lockKey})`);
  }
};

const performDigestSend = async ({
  summary,
  sentinel,
}: {
  summary: Awaited<ReturnType<typeof buildDigestSummary>>;
  sentinel: string;
}): Promise<{ sent: boolean; reason?: string; label?: string }> => {

  const { subject, text } = renderDigestEmail(summary);

  const fromAddr = env.resendFromEmail;
  const toAddr = env.ownerNotificationEmail;
  if (!toAddr) return { sent: false, reason: "no_owner_email" };

  if (!env.resendApiKey) {
    logger.info({ label: summary.label }, "[daily-digest] dev-skipped (no RESEND_API_KEY)");
    await db.insert(emailMessages).values({
      direction: "outbound",
      fromAddr,
      toAddr,
      subject,
      body: text,
      status: "dev_skipped",
      inReplyToId: sentinel,
    });
    return { sent: true, label: summary.label, reason: "dev_skipped" };
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
    logger.info({ label: summary.label }, "[daily-digest] sent");
    return { sent: true, label: summary.label };
  } catch (err) {
    logger.error({ err, label: summary.label }, "[daily-digest] send failed");
    return { sent: false, reason: "send_error", label: summary.label };
  }
};
