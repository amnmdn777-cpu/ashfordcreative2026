import {
  db,
  isPgTrgmReady,
  leads,
  leadRepNotes,
  adminNotifications,
  salesReps,
  callbackSchedules,
  prospectLinks,
  linkEvents,
  twilioMessages,
  emailMessages,
  notifications,
  prospectPortals,
  calls,
  callTranscripts,
  callSummaries,
} from "@workspace/db";
import { presignedAudioUrl } from "../integrations/audioStorage";
import { isPhoneOptedOut } from "../integrations/dialpad";
import { eq, and, sql, desc, isNull, inArray, gte } from "drizzle-orm";
import {
  HOT_LEAD_WINDOW_MS,
  FOLLOW_UP_CALL_THRESHOLD_MS,
  needsFollowUpCall,
} from "@workspace/api-zod";
import { conflict, notFound, badRequest, forbidden } from "../lib/errors";
import { normalizePersonName } from "../lib/normalizeName";
import { logger } from "../lib/logger";
import { sendEmail } from "../integrations/resend";
import { notify } from "./notifications";
import { tierForScore } from "./leadScoring";

export const STALE_CLAIM_DAYS = 7;

/**
 * Strip the lead's `selfServeMeta` jsonb down to the keys the rep
 * dashboard is allowed to see. The column also stores prospect-typed
 * answers (template/palette/addons/funnel session id) that have nothing
 * to do with sales follow-up — only `chosenDomain` is rep-relevant
 * (#185 Comms & Copy Hardening, 2026-04-28). Use at every return site
 * that ships a raw lead row to the rep app.
 */
export const sanitizeLeadForRep = <
  T extends {
    name?: string | null;
    selfServeMeta?: { chosenDomain?: string } | null;
    leadScore?: number | null;
    scoreBreakdown?: { tier?: "A" | "B" | "C" } | null;
  },
>(
  row: T,
): T & {
  selfServeMeta: { chosenDomain: string } | null;
  scoreTier: "A" | "B" | "C" | null;
} => ({
  ...row,
  // Apply name-cleanup at display time as a safety net — even if a
  // scrape leaves doubled tokens like "Cynthia Los De Los Santos" in
  // the DB, every rep-facing surface (available pool, my-leads,
  // detail page, briefings) renders the cleaned form. Idempotent +
  // case-preserving — see normalizeName.ts. Insert sites also
  // normalize at write time so new rows are clean on disk too.
  name: row.name ? normalizePersonName(row.name) : row.name,
  selfServeMeta: row.selfServeMeta?.chosenDomain
    ? { chosenDomain: row.selfServeMeta.chosenDomain }
    : null,
  // Derive tier server-side so the rep app doesn't have to duplicate
  // the cutoffs. Delegates to `tierForScore` (single source of truth in
  // leadScoring.ts) so we can recalibrate in one place — the previous
  // duplicated literal here drifted to 70/40 after #221 lowered cutoffs
  // to 37/28 against the real prod distribution. NULL when we never
  // scored this lead — UI then falls back to the createdAt sort order
  // and shows no badge. #212.
  scoreTier: (() => {
    // Always recompute the tier from the live numeric score using the
    // single-source-of-truth `tierForScore`. We deliberately ignore
    // `scoreBreakdown.tier` whenever a numeric score exists because
    // that JSON field is frozen at score-time — recalibrating cutoffs
    // (#221: 70/40 → 37/28) would otherwise leave every previously
    // scored lead displaying its stale tier letter ("B-57", "C-37"
    // bugs in the rep dashboard) until each lead got rescored. Only
    // when the numeric score is null do we fall back to the stored
    // tier, with legacy "hot"/"warm"/"cold" jsonb rows mapped to the
    // current A/B/C contract so Zod doesn't reject the rep response.
    if (row.leadScore != null) return tierForScore(row.leadScore);
    const raw = row.scoreBreakdown?.tier as string | undefined;
    if (raw === "A" || raw === "B" || raw === "C") return raw;
    if (raw === "hot") return "A";
    if (raw === "warm") return "B";
    if (raw === "cold") return "C";
    return null;
  })(),
});

// Count today's claims by Texas-time (America/Chicago) midnight.
// Retained for backwards-compatible API responses; no cap is enforced.
export const countTodayClaims = async (repId: number): Promise<number> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.claimedByRepId, repId),
        sql`(${leads.claimedAt} AT TIME ZONE 'America/Chicago')::date = (now() AT TIME ZONE 'America/Chicago')::date`,
      ),
    );
  return count;
};

export const claimLead = async (repId: number, leadId: number) => {
  return db.transaction(async (tx) => {
    // Lock the rep row to serialize concurrent opens for the same rep.
    await tx
      .select({ id: salesReps.id })
      .from(salesReps)
      .where(eq(salesReps.id, repId))
      .for("update");

    // Lock the lead row to prevent two reps claiming simultaneously.
    const [lead] = await tx
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .for("update")
      .limit(1);
    if (!lead) throw notFound("Lead not found");
    if (lead.status !== "available" && lead.status !== "recycled") {
      throw conflict(
        `Lead already ${lead.status}. Refresh your queue to see what's available.`,
      );
    }

    const claimedAt = new Date();
    const [updated] = await tx
      .update(leads)
      .set({
        status: "claimed",
        claimedByRepId: repId,
        claimedAt,
        claimExpiresAt: null,
        lastActivityAt: claimedAt,
        updatedAt: claimedAt,
      })
      .where(eq(leads.id, leadId))
      .returning();
    return {
      lead: sanitizeLeadForRep(updated),
      // No daily cap is enforced; we still return a sentinel for API
      // compatibility so existing clients don't break.
      claimsRemainingToday: Number.MAX_SAFE_INTEGER,
    };
  });
};

/**
 * 2026-05-21 — Atomic "Claim this lead" (Sprint 1 streamline).
 *
 * Replaces the legacy two-call dance of `claimLead` followed by
 * `updateLeadByRep({ status: "nurturing" })` on the client. The two
 * calls ran sequentially in the browser; if the second failed (network
 * blip, server restart, browser navigation), the lead landed in the
 * `claimed` state but never reached WIP, orphaned.
 *
 * This function performs both transitions inside one Postgres tx so we
 * either end in `nurturing` (rep owns it, on the WIP queue), or leave
 * the lead untouched.
 *
 * Idempotent for the lead's owner — if the rep already owns it and
 * it's nurturing, no-op.
 */
export const startWorkOnLead = async (repId: number, leadId: number) => {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: salesReps.id })
      .from(salesReps)
      .where(eq(salesReps.id, repId))
      .for("update");

    const [lead] = await tx
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .for("update")
      .limit(1);
    if (!lead) throw notFound("Lead not found");

    const now = new Date();

    if (lead.claimedByRepId === repId && lead.status === "nurturing") {
      return sanitizeLeadForRep(lead);
    }

    if (lead.claimedByRepId === repId) {
      const [updated] = await tx
        .update(leads)
        .set({
          status: "nurturing",
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId))
        .returning();
      return sanitizeLeadForRep(updated);
    }

    if (lead.status !== "available" && lead.status !== "recycled") {
      throw conflict(
        `Lead already ${lead.status}. Refresh your queue to see what's available.`,
      );
    }

    const [updated] = await tx
      .update(leads)
      .set({
        status: "nurturing",
        claimedByRepId: repId,
        claimedAt: now,
        claimExpiresAt: null,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId))
      .returning();
    return sanitizeLeadForRep(updated);
  });
};

// Recycle leads that have been claimed for >= STALE_CLAIM_DAYS with zero activity.
// "Activity" = lastActivityAt updated since claim. We compare lastActivityAt to claimedAt:
// if there's been no further activity, lastActivityAt == claimedAt, so we use the more
// permissive lastActivityAt < (now - 7 days).
export const recycleStaleClaims = async (): Promise<number> => {
  const stale = await db
    .select({ id: leads.id, repId: leads.claimedByRepId, practice: leads.practice })
    .from(leads)
    .where(
      and(
        eq(leads.status, "claimed"),
        sql`${leads.lastActivityAt} < now() - interval '${sql.raw(String(STALE_CLAIM_DAYS))} days'`,
      ),
    );
  if (stale.length === 0) return 0;

  await db
    .update(leads)
    .set({
      status: "available",
      claimedByRepId: null,
      claimedAt: null,
      claimExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(leads.status, "claimed"),
        sql`${leads.lastActivityAt} < now() - interval '${sql.raw(String(STALE_CLAIM_DAYS))} days'`,
      ),
    );

  for (const row of stale) {
    if (!row.repId) continue;
    await notify({
      repId: row.repId,
      type: "lead.recycled",
      title: `Lead recycled: ${row.practice}`,
      body: `No activity in ${STALE_CLAIM_DAYS} days — the lead is back in the public pool.`,
      payload: { leadId: row.id },
      linkUrl: `/dashboard/leads/${row.id}`,
    });
  }

  logger.info({ count: stale.length }, "recycled stale lead claims");
  return stale.length;
};

export const updateLeadByRep = async (
  repId: number,
  leadId: number,
  patch: {
    notes?: string;
    status?: "nurturing" | "won" | "disqualified" | "cold";
    disqualifyReason?:
      | "not_interested"
      | "wrong_number"
      | "do_not_call"
      | "already_has_provider"
      | "out_of_market"
      | "budget_concern"
      | "other";
    disqualifyNote?: string;
    email?: string | null;
    phone?: string;
    locale?: "en" | "es";
    // PHASE A.2 — therapist Calendly + Doxy URLs.
    calendlyUrl?: string | null;
    doxyUrl?: string | null;
  },
  // LOT 1.4 — optional Request so a terminal-status transition can
  // expire the portal AND carry the actor into the portal.expire
  // audit row. Routes that don't have a Request handy (scripts,
  // bulk-mutators) omit this and the expire path falls back to
  // writeAuditExplicit.
  req?: import("express").Request,
) => {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  if (lead.claimedByRepId !== repId)
    throw badRequest("You don't own this lead.");
  const [updated] = await db
    .update(leads)
    .set({
      ...patch,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId))
    .returning();
  // LOT 1.4 — fire portal lifecycle expire inline when the new status
  // is in the terminal set. 'cold' is intentionally NOT here — it
  // means "rep parked for follow-up", killing the preview would block
  // legitimate re-engagement. expirePortalForLead is idempotent and
  // a no-op when the portal is already 'expired'.
  if (
    patch.status === "disqualified" ||
    patch.status === "won"
  ) {
    // Lazy import to break the leads.ts <-> portals.ts cycle (portals
    // imports sanitize helpers from leads).
    const { expirePortalForLead } = await import("./portals");
    await expirePortalForLead(updated.id, patch.status, req);
  }
  return sanitizeLeadForRep(updated);
};

/**
 * Append a timestamped rep-note to a lead's journal (#229, 2026-05-11).
 * Strictly append-only — no edit/delete path — so the feed always
 * reflects what was actually written, in order. Also auto-promotes a
 * `claimed` lead to `nurturing` on the first non-empty note so the
 * Nurturing filter remains the rep's working list of engaged leads
 * (carried over from the old auto-save behaviour).
 */
export const addLeadRepNote = async (
  repId: number,
  leadId: number,
  body: string,
) => {
  const trimmed = body.trim();
  if (trimmed.length === 0) throw badRequest("Note cannot be empty.");
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  if (lead.claimedByRepId !== repId)
    throw badRequest("You don't own this lead.");

  const [inserted] = await db
    .insert(leadRepNotes)
    .values({ leadId, authorRepId: repId, body: trimmed })
    .returning();

  await db
    .update(leads)
    .set({
      lastActivityAt: new Date(),
      updatedAt: new Date(),
      ...(lead.status === "claimed" ? { status: "nurturing" as const } : {}),
    })
    .where(eq(leads.id, leadId));

  const [rep] = await db
    .select({ displayName: salesReps.displayName })
    .from(salesReps)
    .where(eq(salesReps.id, repId))
    .limit(1);

  // 2026-05-14 audit fix #7: @Ashford mention → admin notification + email.
  // Detection is purely text-based (no UI affordance yet) so a rep can
  // flag the owner from anywhere in the note body. Errors here must NOT
  // fail the note insert — we log and degrade silently.
  if (/@Ashford\b/i.test(trimmed)) {
    void notifyAshfordMention({
      leadId,
      repId,
      noteBody: trimmed,
      leadName: lead.name ?? null,
      repName: rep?.displayName ?? null,
    }).catch((err) =>
      logger.warn({ err, leadId, repId }, "notifyAshfordMention failed"),
    );
  }

  return {
    id: inserted.id,
    leadId: inserted.leadId,
    authorRepId: inserted.authorRepId,
    authorName: rep?.displayName ?? null,
    body: inserted.body,
    createdAt: inserted.createdAt,
  };
};

const ASHFORD_OWNER_EMAIL = "amnmdn777@gmail.com";

async function notifyAshfordMention(args: {
  leadId: number;
  repId: number;
  noteBody: string;
  leadName: string | null;
  repName: string | null;
}): Promise<void> {
  await db.insert(adminNotifications).values({
    kind: "rep_tag",
    leadId: args.leadId,
    repId: args.repId,
    body: args.noteBody,
  });
  const adminLeadUrl = `https://admin.ashfordhealthcreative.com/leads/${args.leadId}`;
  const subjectName = args.leadName ?? `lead #${args.leadId}`;
  const subject = `Rep tagged you on ${subjectName}`;
  const repLabel = args.repName ?? `rep #${args.repId}`;
  const excerpt =
    args.noteBody.length > 800
      ? args.noteBody.slice(0, 800) + "…"
      : args.noteBody;
  const htmlBody = `<p>${repLabel} tagged you on <strong>${subjectName}</strong>:</p>` +
    `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;white-space:pre-wrap">${
      excerpt.replace(/</g, "&lt;")
    }</blockquote>` +
    `<p><a href="${adminLeadUrl}">Open lead in admin</a></p>`;
  const textBody =
    `${repLabel} tagged you on ${subjectName}.\n\n${excerpt}\n\n${adminLeadUrl}`;
  logger.info(
    { leadId: args.leadId, repId: args.repId },
    "ashford_mention.email.send",
  );
  await sendEmail({
    to: ASHFORD_OWNER_EMAIL,
    subject,
    body: textBody,
    htmlOverride: htmlBody,
    leadId: args.leadId,
  });
}

/**
 * 2026-05-14: admin replies to a rep's @Ashford mention from the
 * Mentions inbox. Side effects:
 *   1. Append a `lead_rep_notes` row authored by the admin so the
 *      reply appears in the rep's note timeline on the lead.
 *   2. Fire an in-dashboard `notifications` row of type `ashford_reply`
 *      so the rep sees the bell badge.
 *   3. Email the rep at their `salesReps.email` (best-effort, fails
 *      silently so the reply itself stays atomic).
 *   4. Mark the originating `admin_notifications` row as read.
 *
 * Authorization is enforced by the route layer (admin-only); this
 * function trusts the caller and intentionally bypasses
 * `claimedByRepId` ownership checks that gate the rep `addLeadRepNote`
 * path.
 */
export const replyToAdminMention = async (args: {
  adminUserId: number;
  adminDisplayName: string | null;
  notificationId: number;
  body: string;
}) => {
  const trimmed = args.body.trim();
  if (trimmed.length === 0) throw badRequest("Reply cannot be empty.");

  const [notif] = await db
    .select()
    .from(adminNotifications)
    .where(eq(adminNotifications.id, args.notificationId))
    .limit(1);
  if (!notif) throw notFound("Mention not found");
  if (notif.leadId == null || notif.repId == null) {
    throw badRequest("Mention is missing lead or rep context.");
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, notif.leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");

  const [rep] = await db
    .select({
      id: salesReps.id,
      displayName: salesReps.displayName,
      email: salesReps.email,
    })
    .from(salesReps)
    .where(eq(salesReps.id, notif.repId))
    .limit(1);
  if (!rep) throw notFound("Rep not found");

  // 1. Append the reply as a regular rep-note so it shows up in the
  // lead's note timeline. authorRepId = the admin's sales_reps row so
  // the displayName ("Ashford") surfaces naturally in the join.
  const [inserted] = await db
    .insert(leadRepNotes)
    .values({
      leadId: notif.leadId,
      authorRepId: args.adminUserId,
      body: trimmed,
    })
    .returning();

  // 2. In-dashboard notification for the rep — same shape used by
  // every other rep notification so the bell badge + Notifications
  // page already handle it without changes.
  const adminLabel = args.adminDisplayName ?? "Ashford";
  const leadLabel = lead.name ?? `lead #${lead.id}`;
  const linkUrl = `/leads/${lead.id}`;
  try {
    await notify({
      repId: rep.id,
      type: "ashford_reply",
      title: `${adminLabel} replied on ${leadLabel}`,
      body: trimmed.length > 400 ? trimmed.slice(0, 400) + "…" : trimmed,
      linkUrl,
      payload: { leadId: lead.id, noteId: inserted.id },
    });
  } catch (err) {
    logger.warn(
      { err, repId: rep.id, leadId: lead.id },
      "ashford_reply.notify failed",
    );
  }

  // 3. Email the rep. Best-effort: a delivery failure must not undo
  // the note or in-app notification, which are the source of truth.
  if (rep.email) {
    const repFirstName = (rep.displayName ?? "").split(/\s+/)[0] || "there";
    const adminUrl =
      `https://sales.ashfordhealthcreative.com/leads/${lead.id}`;
    const subject = `${adminLabel} replied to your note on ${leadLabel}`;
    const escapedBody = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const htmlBody =
      `<p>Hi ${repFirstName},</p>` +
      `<p><strong>${adminLabel}</strong> replied to your note on ` +
      `<strong>${leadLabel}</strong>:</p>` +
      `<blockquote style="border-left:3px solid #2563eb;padding:8px 12px;` +
      `background:#f5f8ff;color:#1e293b;white-space:pre-wrap;` +
      `margin:12px 0;border-radius:4px">${escapedBody}</blockquote>` +
      `<p><a href="${adminUrl}" style="display:inline-block;` +
      `background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;` +
      `text-decoration:none;font-weight:600">Open lead</a></p>` +
      `<p style="color:#64748b;font-size:12px;margin-top:24px">` +
      `You're getting this because you tagged @Ashford on this lead.</p>`;
    const textBody =
      `Hi ${repFirstName},\n\n` +
      `${adminLabel} replied to your note on ${leadLabel}:\n\n` +
      `${trimmed}\n\n` +
      `Open the lead: ${adminUrl}`;
    try {
      await sendEmail({
        to: rep.email,
        subject,
        body: textBody,
        htmlOverride: htmlBody,
        leadId: lead.id,
        repId: rep.id,
        plain: true,
      });
    } catch (err) {
      logger.warn(
        { err, repId: rep.id, leadId: lead.id },
        "ashford_reply.email failed",
      );
    }
  } else {
    logger.info(
      { repId: rep.id },
      "ashford_reply.email skipped (rep has no email)",
    );
  }

  // 4. Mark the originating mention as read so it stops showing up
  // in the unread inbox after the admin replies.
  await db
    .update(adminNotifications)
    .set({ readAt: new Date() })
    .where(eq(adminNotifications.id, notif.id));

  return {
    id: inserted.id,
    leadId: inserted.leadId,
    authorRepId: inserted.authorRepId,
    authorName: args.adminDisplayName,
    body: inserted.body,
    createdAt: inserted.createdAt,
    rep: {
      id: rep.id,
      displayName: rep.displayName,
      emailed: Boolean(rep.email),
    },
  };
};

/** Newest-first feed of rep-notes for a lead. Ownership check matches
 *  the rest of the rep dashboard — only the claiming rep can read. */
export const listLeadRepNotes = async (repId: number, leadId: number) => {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  if (lead.claimedByRepId !== repId)
    throw forbidden("You don't own this lead.");

  const rows = await db
    .select({
      id: leadRepNotes.id,
      leadId: leadRepNotes.leadId,
      authorRepId: leadRepNotes.authorRepId,
      authorName: salesReps.displayName,
      body: leadRepNotes.body,
      createdAt: leadRepNotes.createdAt,
      originalBody: leadRepNotes.originalBody,
      editedAt: leadRepNotes.editedAt,
    })
    .from(leadRepNotes)
    .leftJoin(salesReps, eq(salesReps.id, leadRepNotes.authorRepId))
    .where(eq(leadRepNotes.leadId, leadId))
    .orderBy(desc(leadRepNotes.createdAt));
  return rows;
};

/**
 * Edit an existing rep-note (#231, 2026-05-14). The owning rep can
 * update the body of a note they wrote. Constraints:
 *   - Only the original author can edit (admins cannot — audit-clean).
 *   - The lead must still be claimed by that rep.
 *   - `originalBody` is captured on the FIRST edit only and never
 *     overwritten on subsequent edits, so the very-first text the
 *     note shipped with is preserved forever.
 *   - `editedAt` is bumped on every edit.
 *
 * Returns the updated row in the same shape as `addLeadRepNote`'s
 * insert, plus `originalBody` / `editedAt` so the rep panel can show
 * the "modified" tag immediately.
 */
export const editLeadRepNote = async (
  repId: number,
  leadId: number,
  noteId: number,
  body: string,
) => {
  const trimmed = body.trim();
  if (trimmed.length === 0) throw badRequest("Note cannot be empty.");

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  if (lead.claimedByRepId !== repId)
    throw forbidden("You don't own this lead.");

  const [existing] = await db
    .select()
    .from(leadRepNotes)
    .where(
      and(eq(leadRepNotes.id, noteId), eq(leadRepNotes.leadId, leadId)),
    )
    .limit(1);
  if (!existing) throw notFound("Note not found");
  if (existing.authorRepId !== repId)
    throw forbidden("You can only edit your own notes.");

  // No-op if the body is identical: don't burn an edit timestamp for
  // a content-free PATCH (keeps the "modified" tag honest).
  if (existing.body === trimmed) {
    const [rep] = await db
      .select({ displayName: salesReps.displayName })
      .from(salesReps)
      .where(eq(salesReps.id, repId))
      .limit(1);
    return {
      id: existing.id,
      leadId: existing.leadId,
      authorRepId: existing.authorRepId,
      authorName: rep?.displayName ?? null,
      body: existing.body,
      createdAt: existing.createdAt,
      originalBody: existing.originalBody,
      editedAt: existing.editedAt,
    };
  }

  const now = new Date();
  const [updated] = await db
    .update(leadRepNotes)
    .set({
      body: trimmed,
      // Capture the original body on the FIRST edit only.
      originalBody: existing.originalBody ?? existing.body,
      editedAt: now,
    })
    .where(eq(leadRepNotes.id, noteId))
    .returning();

  await db
    .update(leads)
    .set({ lastActivityAt: now, updatedAt: now })
    .where(eq(leads.id, leadId));

  const [rep] = await db
    .select({ displayName: salesReps.displayName })
    .from(salesReps)
    .where(eq(salesReps.id, repId))
    .limit(1);

  return {
    id: updated.id,
    leadId: updated.leadId,
    authorRepId: updated.authorRepId,
    authorName: rep?.displayName ?? null,
    body: updated.body,
    createdAt: updated.createdAt,
    originalBody: updated.originalBody,
    editedAt: updated.editedAt,
  };
};

// List leads owned by `repId` whose portal has a `last_hot_alert_at` within
// the last HOT_LEAD_WINDOW_MS (shared with the rep dashboard + LeadDetail
// badge), ordered by most-recent alert first. Returns the lead row with the
// alert timestamp tacked on so the dashboard can show the same 🔥 badge.
export const getHotLeadsForRep = async (repId: number) => {
  const rows = await db
    .select({
      lead: leads,
      lastHotAlertAt: prospectPortals.lastHotAlertAt,
    })
    .from(leads)
    .innerJoin(prospectPortals, eq(prospectPortals.leadId, leads.id))
    .where(
      and(
        eq(leads.claimedByRepId, repId),
        sql`${prospectPortals.lastHotAlertAt} IS NOT NULL`,
        sql`${prospectPortals.lastHotAlertAt} > now() - interval '${sql.raw(String(Math.floor(HOT_LEAD_WINDOW_MS / 1000)))} seconds'`,
      ),
    )
    .orderBy(desc(prospectPortals.lastHotAlertAt));
  return rows.map((r) => ({
    ...sanitizeLeadForRep(r.lead),
    lastHotAlertAt: r.lastHotAlertAt,
  }));
};

export const getRepLeads = async (
  repId: number,
  filter:
    | "active"
    | "nurturing"
    | "won"
    | "disqualified"
    | "cold"
    | "all" = "active",
  name?: string,
) => {
  const baseConds = [eq(leads.claimedByRepId, repId)];
  if (filter === "active") baseConds.push(eq(leads.status, "claimed"));
  if (filter === "nurturing") baseConds.push(eq(leads.status, "nurturing"));
  if (filter === "won") baseConds.push(eq(leads.status, "won"));
  if (filter === "disqualified")
    baseConds.push(eq(leads.status, "disqualified"));
  if (filter === "cold") baseConds.push(eq(leads.status, "cold"));
  // Same typo-tolerant name search as the available pool — substring OR
  // (when pg_trgm is installed) word_similarity ≥ 0.4 against
  // name/practice. Gated on `isPgTrgmReady()` so a missing extension
  // degrades to substring-only instead of breaking the query. Lets a rep
  // type "Dolores" and find "Dr. Delores Hendrix-Giles" in My Leads.
  const trimmedName = name?.trim() ?? "";
  if (trimmedName.length > 0) {
    const needle = `%${trimmedName.toLowerCase()}%`;
    if (isPgTrgmReady()) {
      baseConds.push(
        sql`(
          lower(${leads.name}) LIKE ${needle}
          OR lower(${leads.practice}) LIKE ${needle}
          OR word_similarity(lower(${trimmedName}), lower(${leads.name})) >= 0.4
          OR word_similarity(lower(${trimmedName}), lower(${leads.practice})) >= 0.4
        )`,
      );
    } else {
      baseConds.push(
        sql`(lower(${leads.name}) LIKE ${needle} OR lower(${leads.practice}) LIKE ${needle})`,
      );
    }
  }
  const rows = await db
    .select()
    .from(leads)
    .where(and(...baseConds))
    // Best-tier first, then most-recently-active. Rep wanted score-
    // sorted lists everywhere they pick a lead to call next, not just
    // on the unclaimed pool — same NULLS LAST tiebreak as
    // getAvailableLeads so an unscored lead doesn't outrank a tier-A.
    .orderBy(
      sql`${leads.leadScore} DESC NULLS LAST`,
      desc(leads.lastActivityAt),
    );

  // Decorate every row with the #208 "needs follow-up call" cue so the
  // leads list can render the badge inline without an extra round trip
  // per row. Two batched lookups (portals + recent calls), one shared
  // predicate from api-zod — the rep dashboard derives the same boolean
  // inline from the timeline payload so the badge and the callout never
  // disagree.
  const decorated = await decorateNeedsFollowUpCall(rows);
  return decorated.map((row) => ({
    ...sanitizeLeadForRep(row),
    needsFollowUpCall: row.needsFollowUpCall,
  }));
};

/**
 * Batch-resolve the #208 cue for a set of lead rows. Issues at most two
 * extra queries (portals by leadId, calls by leadId in the last
 * FOLLOW_UP_CALL_THRESHOLD_MS) so the per-row decoration stays O(1) — the
 * leads list can call this on every page render without N+1 risk.
 *
 * Empty input short-circuits to avoid sending an `inArray([])` predicate
 * to drizzle, which would compile to an `IN ()` SQL fragment and fail.
 */
export const decorateNeedsFollowUpCall = async <
  T extends { id: number; status: typeof leads.$inferSelect.status },
>(
  rows: T[],
): Promise<Array<T & { needsFollowUpCall: boolean }>> => {
  if (rows.length === 0) return [];
  const leadIds = rows.map((r) => r.id);
  const now = new Date();
  const recentCallSince = new Date(now.getTime() - FOLLOW_UP_CALL_THRESHOLD_MS);

  const [portalRows, recentCallRows] = await Promise.all([
    db
      .select({
        leadId: prospectPortals.leadId,
        inviteSentAt: prospectPortals.inviteSentAt,
        openCount: prospectPortals.openCount,
      })
      .from(prospectPortals)
      .where(inArray(prospectPortals.leadId, leadIds)),
    db
      .select({ leadId: calls.leadId })
      .from(calls)
      .where(
        and(
          inArray(calls.leadId, leadIds),
          // `gte` (inclusive) matches the shared `isRecentFollowUpCall`
          // helper used by LeadDetail so the SQL filter and the in-memory
          // walk agree at exactly the FOLLOW_UP_CALL_THRESHOLD_MS boundary.
          gte(calls.createdAt, recentCallSince),
        ),
      ),
  ]);

  const portalByLead = new Map<
    number,
    { inviteSentAt: Date | null; openCount: number }
  >();
  for (const p of portalRows) {
    portalByLead.set(p.leadId, {
      inviteSentAt: p.inviteSentAt,
      openCount: p.openCount,
    });
  }
  const recentCallLeadIds = new Set<number>();
  for (const c of recentCallRows) {
    if (c.leadId != null) recentCallLeadIds.add(c.leadId);
  }

  return rows.map((row) => {
    const portal = portalByLead.get(row.id);
    return {
      ...row,
      needsFollowUpCall: needsFollowUpCall({
        status: row.status,
        inviteSentAt: portal?.inviteSentAt ?? null,
        openCount: portal?.openCount ?? 0,
        hasRecentCall: recentCallLeadIds.has(row.id),
        now,
      }),
    };
  });
};

export const getAvailableLeads = async (filters: {
  city?: string;
  specialty?: string;
  name?: string;
  page?: number;
  pageSize?: number;
  topQualityOnly?: boolean;
  /** Website filter — "yes" surfaces only leads that already have a
   *  current_website value (we can pitch a refresh / migration);
   *  "no" surfaces only leads with NULL/empty current_website (greenfield
   *  pitch). Undefined = no filter. */
  hasWebsite?: "yes" | "no";
  /** #221 — column-header sorting on Available Leads. Default = score
   *  DESC (preserves the historical "best-quality first" ordering). */
  sortBy?: "score" | "name" | "city" | "practice" | "specialty";
  sortDir?: "asc" | "desc";
}) => {
  const conds = [
    sql`(${leads.status} = 'available' OR ${leads.status} = 'recycled')`,
    isNull(leads.claimedByRepId),
  ];
  if (filters.city) conds.push(sql`lower(${leads.city}) = lower(${filters.city})`);
  if (filters.specialty)
    conds.push(sql`lower(${leads.specialty}) = lower(${filters.specialty})`);
  // "Top quality only" surfaces just the hot tier (score ≥ 70) so reps
  // can drill into the best half-hour of the day. Unscored leads (NULL)
  // are excluded from this filter on purpose — they haven't proven
  // themselves yet. #212.
  if (filters.topQualityOnly) {
    conds.push(sql`${leads.leadScore} >= 37`);
  }
  // Website presence filter. Treat empty string the same as NULL so
  // legacy rows imported with "" don't slip into the "has website" pool.
  if (filters.hasWebsite === "yes") {
    conds.push(
      sql`${leads.currentWebsite} IS NOT NULL AND ${leads.currentWebsite} <> ''`,
    );
  } else if (filters.hasWebsite === "no") {
    conds.push(
      sql`(${leads.currentWebsite} IS NULL OR ${leads.currentWebsite} = '')`,
    );
  }
  // Free-text name search: typo-tolerant. We match either by case-insensitive
  // substring (catches partial words / multi-token queries) OR — when
  // pg_trgm is installed — by `word_similarity` above 0.4 (catches
  // "Dolores" → "Dr. Delores Hendrix-Giles" and other one-letter slips).
  // word_similarity scores against the closest word in the haystack so a
  // long surname doesn't dilute the match the way plain similarity() does.
  // Both checks run against name AND practice. We GATE the trigram clause
  // on `isPgTrgmReady()`: emitting `word_similarity(...)` when the
  // extension is missing throws `function does not exist` and breaks the
  // entire query, defeating the LIKE fallback. With the gate, search
  // gracefully degrades to substring-only when the extension isn't
  // available.
  const trimmedName = filters.name?.trim() ?? "";
  if (trimmedName.length > 0) {
    const needle = `%${trimmedName.toLowerCase()}%`;
    if (isPgTrgmReady()) {
      conds.push(
        sql`(
          lower(${leads.name}) LIKE ${needle}
          OR lower(${leads.practice}) LIKE ${needle}
          OR word_similarity(lower(${trimmedName}), lower(${leads.name})) >= 0.4
          OR word_similarity(lower(${trimmedName}), lower(${leads.practice})) >= 0.4
        )`,
      );
    } else {
      conds.push(
        sql`(lower(${leads.name}) LIKE ${needle} OR lower(${leads.practice}) LIKE ${needle})`,
      );
    }
  }
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...conds));
  // #221 sortable columns. Whitelist column → drizzle column mapping so
  // the dynamic ORDER BY can never be poisoned by raw client input.
  // Score sort still gets NULLS LAST so unscored leads stay below scored
  // ones regardless of direction. Other columns get a createdAt
  // tiebreaker so paginated results are stable.
  const sortBy = filters.sortBy ?? "score";
  const dir = filters.sortDir ?? "desc";
  const dirSql = dir === "asc" ? sql`ASC` : sql`DESC`;
  const orderClause = (() => {
    switch (sortBy) {
      case "name":
        return sql`${leads.name} ${dirSql} NULLS LAST`;
      case "city":
        return sql`${leads.city} ${dirSql} NULLS LAST`;
      case "practice":
        return sql`${leads.practice} ${dirSql} NULLS LAST`;
      case "specialty":
        return sql`${leads.specialty} ${dirSql} NULLS LAST`;
      case "score":
      default:
        return sql`${leads.leadScore} ${dirSql} NULLS LAST`;
    }
  })();
  const rows = await db
    .select()
    .from(leads)
    .where(and(...conds))
    .orderBy(orderClause, desc(leads.createdAt))
    .limit(pageSize)
    .offset(offset);
  return {
    // sanitize each row so the public-pool surface doesn't leak any
    // self-serve prospect answers — same rule as the claimed/timeline
    // surfaces (#185 Comms & Copy Hardening, 2026-04-28).
    rows: rows.map(sanitizeLeadForRep),
    page,
    pageSize,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
  };
};

export const scheduleCallback = async (
  repId: number,
  leadId: number,
  scheduledFor: Date,
  note?: string,
) => {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  if (lead.claimedByRepId !== repId)
    throw badRequest("You don't own this lead.");
  const [row] = await db
    .insert(callbackSchedules)
    .values({ leadId, repId, scheduledFor, note })
    .returning();
  // Bump activity so the recycler doesn't claim it.
  await db
    .update(leads)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  return row;
};

// Full lead timeline: returns the lead row + chronological events (callbacks,
// preview links, link events, sms, emails, notifications). When `requestingRepId`
// is supplied we enforce that they own the lead.
export const getLeadTimeline = async (
  leadId: number,
  requestingRepId?: number,
) => {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  // Claimed by someone else → hard 403.
  if (
    requestingRepId !== undefined &&
    lead.claimedByRepId !== null &&
    lead.claimedByRepId !== requestingRepId
  ) {
    throw forbidden("You don't own this lead.");
  }
  // Unclaimed leads: any rep can *preview* the row, but PII is redacted
  // and timeline collections are empty. Reps must `claim` to see contact
  // info. Without this gate, a session rep could enumerate all 561
  // available leads' phone/email/notes via the detail endpoint (IDOR).
  const redacted =
    requestingRepId !== undefined && lead.claimedByRepId === null;
  if (redacted) {
    const redactedLead = {
      ...lead,
      phone: null as unknown as typeof lead.phone,
      email: null,
      currentWebsite: null,
      profileBlurb: null,
      notes: null,
      disqualifyNote: null,
      selfServeMeta: null,
      phoneOptedOut: false,
    };
    return {
      lead: redactedLead,
      redacted: true as const,
      callbacks: [],
      links: [],
      linkEvents: [],
      sms: [],
      emails: [],
      notifications: [],
      portal: null,
      calls: [],
    };
  }
  const [callbacks, links, sms, emails, repNotifs, portalRow, callRows] = await Promise.all([
    db
      .select()
      .from(callbackSchedules)
      .where(eq(callbackSchedules.leadId, leadId))
      .orderBy(desc(callbackSchedules.scheduledFor)),
    db
      .select()
      .from(prospectLinks)
      .where(eq(prospectLinks.leadId, leadId))
      .orderBy(desc(prospectLinks.createdAt)),
    db
      .select()
      .from(twilioMessages)
      .where(eq(twilioMessages.leadId, leadId))
      .orderBy(desc(twilioMessages.occurredAt)),
    db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.leadId, leadId))
      .orderBy(desc(emailMessages.occurredAt)),
    db
      .select()
      .from(notifications)
      .where(sql`${notifications.payload}->>'leadId' = ${String(leadId)}`)
      .orderBy(desc(notifications.createdAt))
      .limit(50),
    db
      .select({
        id: prospectPortals.id,
        slug: prospectPortals.slug,
        lastHotAlertAt: prospectPortals.lastHotAlertAt,
        lastOpenedAt: prospectPortals.lastOpenedAt,
        openCount: prospectPortals.openCount,
      })
      .from(prospectPortals)
      .where(eq(prospectPortals.leadId, leadId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    // Calls (with transcript + summary joined). Left-join so calls show up
    // on the timeline even before transcription/summarization completes.
    db
      .select({
        call: calls,
        transcript: callTranscripts,
        summary: callSummaries,
      })
      .from(calls)
      .leftJoin(callTranscripts, eq(callTranscripts.callId, calls.id))
      .leftJoin(callSummaries, eq(callSummaries.callId, calls.id))
      .where(eq(calls.leadId, leadId))
      .orderBy(desc(calls.createdAt)),
  ]);

  // Mint short-lived audio URLs in parallel — keeps the timeline payload
  // self-contained so the rep dashboard's `<audio>` tag works without an
  // extra round trip.
  const callsWithAudio = await Promise.all(
    callRows.map(async (r) => {
      const objectKey =
        r.call.recordingObjectKey ?? r.call.voicemailObjectKey ?? null;
      const audioUrl = objectKey ? await presignedAudioUrl(objectKey) : null;
      return {
        ...r.call,
        transcript: r.transcript,
        summary: r.summary,
        audioUrl,
      };
    }),
  );

  // Pull link events for any link belonging to this lead.
  const linkIds = links.map((l) => l.id);
  const events =
    linkIds.length > 0
      ? await db
          .select()
          .from(linkEvents)
          .where(inArray(linkEvents.linkId, linkIds))
          .orderBy(desc(linkEvents.occurredAt))
      : [];

  // Surface DNC status alongside the lead so the rep app can pre-disable
  // the call action (instead of waiting for an outbound rejection AFTER
  // the rep clicks). Only resolved when there's actually a phone — saves
  // the smsOptOuts lookup on email-only leads.
  const phoneOptedOut = lead.phone ? await isPhoneOptedOut(lead.phone) : false;

  // Strip selfServeMeta down to just the keys reps are allowed to see.
  // The DB jsonb may include prospect-typed answers (template, palette,
  // copy edits, funnel session id, etc.) that have nothing to do with
  // sales follow-up — only `chosenDomain` is rep-relevant (#185 Comms &
  // Copy Hardening, 2026-04-28). Whitelist explicitly so a future
  // self-serve field doesn't leak by accident.
  const safeSelfServeMeta = lead.selfServeMeta?.chosenDomain
    ? { chosenDomain: lead.selfServeMeta.chosenDomain }
    : null;

  return {
    lead: { ...lead, phoneOptedOut, selfServeMeta: safeSelfServeMeta },
    redacted: false as const,
    callbacks,
    links,
    linkEvents: events.map((e) => ({ ...e, kind: e.eventType })),
    sms,
    emails,
    notifications: repNotifs,
    portal: portalRow,
    calls: callsWithAudio,
  };
};

export const getRepCallbacks = async (repId: number) =>
  db
    .select()
    .from(callbackSchedules)
    .where(
      and(eq(callbackSchedules.repId, repId), isNull(callbackSchedules.completedAt)),
    )
    .orderBy(callbackSchedules.scheduledFor);
