import { z } from "zod";

/**
 * How long after `prospect_portals.last_hot_alert_at` we still consider a
 * lead "hot" (portal-reopen alert — separate from the A/B/C score tier).
 * Shared across the API (filtering /dashboard/leads/hot), the
 * rep dashboard's "Hot now" section, and the LeadDetail header badge so
 * all three surfaces stay in sync.
 */
export const HOT_LEAD_WINDOW_MS = 60 * 60 * 1000;

export const LeadStatus = z.enum([
  "available",
  "claimed",
  "nurturing",
  "won",
  "disqualified",
  "recycled",
  "cold",
]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const DisqualifyReason = z.enum([
  "not_interested",
  "wrong_number",
  "do_not_call",
  "already_has_provider",
  "out_of_market",
  "budget_concern",
  "other",
]);
export type DisqualifyReason = z.infer<typeof DisqualifyReason>;

/**
 * Window for the "needs follow-up call" cue (#208). A lead qualifies when
 * the preview email/portal invite was sent at least this long ago AND the
 * prospect hasn't opened the portal AND the rep hasn't logged a call within
 * the same window. The same constant is reused for both halves of the test
 * (age of invite, age of last call) so the badge clears as soon as the rep
 * dials — no awkward "you just called but it still says call them" gap.
 */
export const FOLLOW_UP_CALL_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Pure predicate that decides whether to surface the "needs follow-up call"
 * cue (badge on the leads list, callout above step 6 on lead detail). Shared
 * by the api-server (decorating /dashboard/leads/mine rows) and the rep
 * dashboard (deriving the same boolean inline from the timeline payload).
 *
 * Caller is responsible for converting `inviteSentAt` from whatever its
 * source representation is (Date from the DB, string from JSON) — both are
 * accepted so the same call site works on either side.
 *
 * `hasRecentCall` is the precomputed "any call row for this lead in the last
 * FOLLOW_UP_CALL_THRESHOLD_MS" check. Pre-computing keeps this function
 * synchronous and trivially testable; the caller does the SQL or the
 * `calls.some(...)` walk.
 */
export type NeedsFollowUpCallInput = {
  status: LeadStatus;
  inviteSentAt: string | Date | null;
  openCount: number;
  hasRecentCall: boolean;
  now?: Date;
};

/**
 * Shared "is this call recent enough to clear the cue?" check. Both the
 * SQL filter on the api-server side and the in-memory `calls.some(...)`
 * walk on the rep dashboard side route through this helper so the two
 * sides cannot drift on the boundary semantics (`>` vs `>=`). A call
 * that's exactly FOLLOW_UP_CALL_THRESHOLD_MS old counts as recent, on
 * the principle that "rep just dialed, don't tell them to dial again".
 */
export const isRecentFollowUpCall = (
  createdAt: string | Date,
  now: Date = new Date(),
): boolean => {
  const t =
    typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= FOLLOW_UP_CALL_THRESHOLD_MS;
};
export const needsFollowUpCall = (input: NeedsFollowUpCallInput): boolean => {
  // Closed deals and disqualified leads are out of the workflow — no cue
  // ever, regardless of how stale the invite is.
  if (
    input.status === "won" ||
    input.status === "disqualified" ||
    input.status === "cold"
  )
    return false;
  // Any portal open clears the cue: the prospect is engaging, the rep
  // should be watching the timeline + hot-lead alerts instead.
  if (input.openCount > 0) return false;
  // A logged call in the last 24h means the rep already followed up; the
  // cue is for "send-and-forgot" leads only.
  if (input.hasRecentCall) return false;
  // No invite ever sent means we're not yet at step 5; the cue belongs
  // strictly to the gap between step 5 (preview email) and step 6
  // (payment link).
  if (!input.inviteSentAt) return false;
  const sent =
    typeof input.inviteSentAt === "string"
      ? new Date(input.inviteSentAt)
      : input.inviteSentAt;
  if (Number.isNaN(sent.getTime())) return false;
  const now = input.now ?? new Date();
  return now.getTime() - sent.getTime() >= FOLLOW_UP_CALL_THRESHOLD_MS;
};

export const LeadDto = z.object({
  id: z.number().int(),
  name: z.string(),
  practice: z.string(),
  specialty: z.string(),
  city: z.string(),
  state: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  currentWebsite: z.string().nullable(),
  profileBlurb: z.string().nullable(),
  status: LeadStatus,
  claimedByRepId: z.number().int().nullable(),
  claimedAt: z.string().nullable(),
  claimExpiresAt: z.string().nullable(),
  lastActivityAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  // True iff the lead's phone is on the SMS opt-out list. Voice/SMS
  // outbound is gated server-side regardless, but the rep app uses this
  // flag to pre-disable the Call action so the rep doesn't waste a
  // confirm-and-fail round trip. Optional so older clients still parse
  // responses cleanly.
  phoneOptedOut: z.boolean().optional(),
  // True when the lead matches the #208 "needs follow-up call" predicate
  // (preview email sent ≥24h ago, portal never opened, no call logged
  // in the last 24h, lead still active). Decorated by the rep-leads list
  // endpoint; optional so older clients still parse responses cleanly.
  needsFollowUpCall: z.boolean().optional(),
  // Quality score (0-100) computed by the api-server's leadScoring
  // service from the latest enrichment payloads. NULL for leads that
  // have never been scored yet — those sort to the end of the available
  // pool. The derived `scoreTier` saves the rep app from duplicating
  // the 70/40 thresholds. Both fields are optional so older clients
  // (and routes that don't go through sanitizeLeadForRep yet) still
  // parse responses cleanly. #212.
  //
  // Tier values use plain alphabet labels (A = best, C = lowest) instead
  // of temperature words like "hot/warm/cold" — the rep team explicitly
  // asked for neutral category names that don't carry positive/negative
  // connotations.
  leadScore: z.number().int().nullable().optional(),
  scoreTier: z.enum(["A", "B", "C"]).nullable().optional(),
  scoreBreakdown: z
    .object({
      total: z.number().int(),
      tier: z.enum(["A", "B", "C"]),
      signals: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          points: z.number().int(),
          max: z.number().int(),
          note: z.string().optional(),
        }),
      ),
    })
    .nullable()
    .optional(),
  // Sales-only side metadata that originated with self-serve template
  // leads but is now also written by reps via the recommended-domains
  // modal (#185 Comms & Copy Hardening, 2026-04-28).
  //
  // Strict allowlist on purpose — the underlying jsonb column may
  // contain other prospect-typed answers (template choice, palette,
  // copy edits, etc.) that the rep dashboard has no business with.
  // If a future field needs to surface to reps, add it here explicitly
  // rather than reverting to .passthrough().
  selfServeMeta: z
    .object({
      chosenDomain: z.string().optional(),
    })
    .strict()
    .nullable()
    .optional(),
  // Therapist-provided scheduling + telehealth URLs (PHASE A.2).
  // Optional so older clients still parse responses cleanly.
  calendlyUrl: z.string().nullable().optional(),
  doxyUrl: z.string().nullable().optional(),
});
export type LeadDto = z.infer<typeof LeadDto>;

export const ClaimLeadResponse = z.object({
  lead: LeadDto,
  claimsRemainingToday: z.number().int(),
});
export type ClaimLeadResponse = z.infer<typeof ClaimLeadResponse>;

export const UpdateLeadRequest = z.object({
  notes: z.string().max(2000).optional(),
  status: z.enum(["nurturing", "won", "disqualified", "cold"]).optional(),
  disqualifyReason: DisqualifyReason.optional(),
  disqualifyNote: z.string().max(500).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(7).max(32).optional(),
  locale: z.enum(["en", "es"]).optional(),
  // Therapist-provided scheduling + telehealth URLs. The rep types
  // these into LeadDetail once the lead shares them; the public site
  // BookingWidget + DoxyBridge thread them into the prospect preview.
  // Empty string is normalized to null so a rep can clear a value.
  calendlyUrl: z
    .string()
    .max(256)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : v === undefined ? undefined : null)),
  doxyUrl: z
    .string()
    .max(256)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : v === undefined ? undefined : null)),
});
export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequest>;

// Discriminated union for status transitions — each variant enforces its own payload shape.
export const UpdateLeadStatusRequest = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("nurturing"),
    note: z.string().max(2000).optional(),
    callbackAt: z.string().datetime().optional(),
  }),
  z.object({ status: z.literal("won") }),
  z.object({
    status: z.literal("disqualified"),
    reason: DisqualifyReason,
    note: z.string().max(500).optional(),
  }),
  z.object({
    status: z.literal("cold"),
    note: z.string().max(500).optional(),
  }),
]);
export type UpdateLeadStatusRequest = z.infer<typeof UpdateLeadStatusRequest>;

export const ScheduleCallbackRequest = z.object({
  leadId: z.number().int(),
  scheduledFor: z.string(),
  note: z.string().max(500).optional(),
  sendRecap: z.boolean().optional(),
});
export type ScheduleCallbackRequest = z.infer<typeof ScheduleCallbackRequest>;

export const CallbackDto = z.object({
  id: z.number().int(),
  leadId: z.number().int(),
  repId: z.number().int(),
  scheduledFor: z.string(),
  note: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type CallbackDto = z.infer<typeof CallbackDto>;

export const SendSmsRequest = z.object({
  leadId: z.number().int(),
  body: z.string().min(1).max(1600),
});
export type SendSmsRequest = z.infer<typeof SendSmsRequest>;

/**
 * Append-only rep-notes journal entry (#229, 2026-05-11). Each row is a
 * single timestamped note typed by the rep on the lead detail page.
 * `authorName` is the rep's display name resolved server-side so the
 * feed can show "Maria · 2 days ago" without an extra round trip. It is
 * nullable for entries seeded from the legacy `leads.rep_notes` column
 * whose author may no longer be on the team, or whose claim was cleared
 * before migration.
 */
export const LeadRepNoteDto = z.object({
  id: z.number().int(),
  leadId: z.number().int(),
  authorRepId: z.number().int().nullable(),
  authorName: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  // #231 (2026-05-14) — edit history. Both NULL = note has never been
  // edited. On first edit, `originalBody` captures the pre-edit body
  // (set once, never overwritten on subsequent edits); `editedAt`
  // bumps on every edit so the UI can show a "modified <time>" tag.
  originalBody: z.string().nullable().optional(),
  editedAt: z.string().nullable().optional(),
});
export type LeadRepNoteDto = z.infer<typeof LeadRepNoteDto>;

export const AddLeadRepNoteRequest = z.object({
  body: z.string().min(1).max(4000),
});
export type AddLeadRepNoteRequest = z.infer<typeof AddLeadRepNoteRequest>;

export const SendEmailRequest = z.object({
  leadId: z.number().int(),
  subject: z.string().min(1).max(256),
  body: z.string().min(1).max(20000),
});
export type SendEmailRequest = z.infer<typeof SendEmailRequest>;
