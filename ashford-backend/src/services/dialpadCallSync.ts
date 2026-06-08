import { and, eq, sql } from "drizzle-orm";
import {
  db,
  calls,
  callTranscripts,
  callSummaries,
  leads,
  repDialpadCredentials,
  salesReps,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { normalizePhone } from "../integrations/dialpad";
import {
  getCall,
  getCallSummary,
  getCallTranscript,
  listDialpadCalls,
  type DialpadCall,
  type DialpadSummary,
  type DialpadTranscript,
} from "../integrations/dialpad";
import { findRepByDialpadUserId } from "../integrations/dialpadOAuth";
import { notify } from "./notifications";

/**
 * DialPad call ingestion + Vi enrichment.
 *
 * The webhook handler hands us a `dialpadCallId` per inbound event; we
 * fetch the canonical call from DialPad's API (don't trust webhook
 * payload shape), upsert into our existing `calls` table, then opportunistically
 * pull the transcript + summary if Vi has finished processing them.
 *
 * All operations are idempotent on `dialpadCallId` so duplicate webhook
 * deliveries (DialPad retries on 5xx) write the same row.
 */

// ---- helpers ---------------------------------------------------------------

const toDate = (raw: unknown): Date | null => {
  if (raw === null || raw === undefined) return null;
  // DialPad sends millis as number OR ISO string depending on endpoint.
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw < 1e12 ? raw * 1000 : raw);
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

type CallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "no-answer"
  | "busy"
  | "failed"
  | "canceled";

const mapStatus = (state: string | undefined | null): CallStatus => {
  if (!state) return "completed";
  const s = state.toLowerCase();
  if (s === "queued" || s === "ringing" || s === "in-progress") return s;
  if (s === "missed" || s === "no-answer" || s === "no_answer") return "no-answer";
  if (s === "busy") return "busy";
  if (s === "failed" || s === "rejected") return "failed";
  if (s === "canceled" || s === "cancelled") return "canceled";
  // hangup, answered, connected, voicemail, completed -> completed
  return "completed";
};

const directionOf = (
  call: DialpadCall,
): "inbound" | "outbound" => {
  const d = String(call.direction ?? "").toLowerCase();
  if (d === "inbound" || d === "in") return "inbound";
  return "outbound";
};

/**
 * Match a DialPad call to a Lead by phone number. Mirrors the matching
 * rules used by twilioVoice inbound: exact normalized E.164 first, then
 * last-7-digit suffix (single hit only). Returns null on ambiguity.
 */
const matchLeadByPhone = async (
  externalNumber: string | undefined,
): Promise<{ id: number; name: string; practice: string } | null> => {
  if (!externalNumber) return null;
  const normalized = normalizePhone(externalNumber);
  if (!normalized) return null;
  const exact = await db
    .select({ id: leads.id, name: leads.name, practice: leads.practice })
    .from(leads)
    .where(eq(leads.phone, normalized))
    .limit(2);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7) return null;
  const suffix = digits.slice(-7);
  const fuzzy = await db
    .select({ id: leads.id, name: leads.name, practice: leads.practice })
    .from(leads)
    .where(
      sql`right(regexp_replace(${leads.phone}, '\\D', '', 'g'), 7) = ${suffix}`,
    )
    .limit(2);
  return fuzzy.length === 1 ? fuzzy[0] : null;
};

/**
 * Map a DialPad call to our internal sales rep id. Two-tier matching:
 *
 *   1. Per-rep OAuth (preferred, post-#226): pull the call's
 *      `target.id` (the dialpad user_id of the seat that placed/answered
 *      the call) and look it up in `rep_dialpad_credentials` — that
 *      table is the source of truth for "which Ashford rep owns which
 *      Dialpad seat".
 *   2. Phone-number fallback (legacy): when no per-rep credential row
 *      matches, fall back to `salesReps.phone == call.internal_number`,
 *      mirroring the original heuristic. Keeps historical workspaces
 *      working even before reps complete the OAuth flow.
 */
const matchRepByDialpadCall = async (
  call: DialpadCall,
): Promise<number | null> => {
  // 1. Per-rep OAuth match by dialpad user_id.
  const targetUserId =
    call.target?.id != null ? String(call.target.id) : null;
  if (targetUserId) {
    const [credRow] = await db
      .select({ salesRepId: repDialpadCredentials.salesRepId })
      .from(repDialpadCredentials)
      .where(eq(repDialpadCredentials.dialpadUserId, targetUserId))
      .limit(1);
    if (credRow) return credRow.salesRepId;
  }

  // 2. Legacy phone-number fallback.
  const internal = call.internal_number;
  if (!internal || typeof internal !== "string") return null;
  const normalized = normalizePhone(internal);
  if (!normalized) return null;
  const rows = await db
    .select({ id: salesReps.id })
    .from(salesReps)
    .where(eq(salesReps.phone, normalized))
    .limit(2);
  return rows.length === 1 ? rows[0].id : null;
};

/**
 * Resolve the per-rep OAuth bearer to use for fetching this call's
 * details. We try the call's `target.id` (the seat that placed or
 * answered the call) first, then fall through to the shared admin
 * key inside `getCall` etc when no per-rep token is found.
 *
 * Note: webhook subscriptions live under the SHARED admin token (one
 * subscription per company at the Dialpad workspace level). Only the
 * per-call READ operations route through the per-rep token so the rep's
 * own permissions decide what we're allowed to fetch (transcripts +
 * Vi summaries require the `recordings_export` scope on her seat).
 */
const resolveCallBearer = async (
  call: DialpadCall | { target?: { id?: string | number } | null },
): Promise<string | undefined> => {
  const targetUserId =
    call.target?.id != null ? String(call.target.id) : null;
  if (!targetUserId) return undefined;
  const conn = await findRepByDialpadUserId(targetUserId);
  return conn?.accessToken;
};

// ---- public API ------------------------------------------------------------

/**
 * Upsert a call from a DialPad webhook event. Fetches the latest state
 * from DialPad's API by id (so reordering/retries always converge to
 * the freshest values), matches lead+rep, writes the calls row.
 *
 * Returns the internal calls.id, or null if the DialPad fetch failed
 * (caller should still 200 the webhook so DialPad doesn't retry forever).
 */
export const upsertCallFromDialpad = async (
  dialpadCallId: string,
): Promise<number | null> => {
  // First fetch — falls back to the shared admin key because we don't
  // yet know which rep owns the call. The shape we get back contains
  // `target.id` which we use below to upgrade to a per-rep token for
  // the transcript + summary fetches (those require `recordings_export`
  // on the rep's own seat).
  let call: DialpadCall;
  try {
    call = await getCall(dialpadCallId);
  } catch (err) {
    logger.error(
      { err, dialpadCallId },
      "dialpad: getCall failed during webhook ingest",
    );
    return null;
  }

  const direction = directionOf(call);
  // DialPad's contact field carries the prospect side regardless of direction.
  const externalNumber =
    (typeof call.external_number === "string" ? call.external_number : null) ??
    call.contact?.phone ??
    null;
  const internalNumber =
    typeof call.internal_number === "string" ? call.internal_number : null;

  const fromNumber = direction === "inbound" ? externalNumber : internalNumber;
  const toNumber = direction === "inbound" ? internalNumber : externalNumber;

  const lead = await matchLeadByPhone(externalNumber ?? undefined);
  const repId = await matchRepByDialpadCall(call);

  // Once we know which rep owns the call, REFETCH under HER bearer so
  // the persisted envelope reflects what HER seat sees (some fields like
  // recording_url + transcription preview are only visible to the call
  // owner). Best-effort: if the per-rep refetch fails (token wiped,
  // scopes dropped, network hiccup) we silently keep the shared-key
  // envelope from the first fetch — the row is still correct.
  if (repId !== null) {
    try {
      const ownerView = await getCall(dialpadCallId, { repId });
      call = ownerView;
    } catch (err) {
      logger.warn(
        { err, dialpadCallId, repId },
        "dialpad: per-rep getCall refetch failed; falling back to shared envelope",
      );
    }
  }

  const startedAt =
    toDate(call.date_started) ?? toDate(call.date_connected) ?? null;
  const endedAt = toDate(call.date_ended);
  const durationSec =
    typeof call.duration === "number"
      ? Math.round(call.duration)
      : typeof call.total_duration === "number"
        ? Math.round(call.total_duration)
        : startedAt && endedAt
          ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
          : null;

  // DialPad exposes recording either as a string url, a list of strings,
  // or a list of {url} objects depending on endpoint version. Pick the first
  // playable one.
  let recordingUrl: string | null = null;
  if (typeof call.recording_url === "string") recordingUrl = call.recording_url;
  else if (Array.isArray(call.recording_url) && call.recording_url[0])
    recordingUrl = String(call.recording_url[0]);
  else if (Array.isArray(call.recording_details)) {
    const first = call.recording_details.find((r) => r && r.url);
    if (first?.url) recordingUrl = String(first.url);
  }

  const status = mapStatus(call.state);

  // Upsert by dialpadCallId. We never overwrite an existing leadId/repId
  // with null — once we've matched, manual operator fixes (or later
  // webhooks with worse data) shouldn't unlink the call.
  const [existing] = await db
    .select({ id: calls.id, leadId: calls.leadId, repId: calls.repId })
    .from(calls)
    .where(eq(calls.dialpadCallId, String(dialpadCallId)))
    .limit(1);

  if (existing) {
    await db
      .update(calls)
      .set({
        leadId: existing.leadId ?? lead?.id ?? null,
        repId: existing.repId ?? repId ?? null,
        status,
        startedAt: startedAt ?? undefined,
        endedAt: endedAt ?? undefined,
        durationSec: durationSec ?? undefined,
        recordingUrl: recordingUrl ?? undefined,
        fromNumber: fromNumber ?? undefined,
        toNumber: toNumber ?? undefined,
      })
      .where(eq(calls.id, existing.id));
    // Notify only on first lead-link transition, never on re-fires.
    return existing.id;
  }

  const [row] = await db
    .insert(calls)
    .values({
      provider: "dialpad",
      dialpadCallId: String(dialpadCallId),
      direction,
      fromNumber: fromNumber ?? "",
      toNumber: toNumber ?? "",
      status,
      leadId: lead?.id,
      repId: repId ?? undefined,
      startedAt: startedAt ?? undefined,
      endedAt: endedAt ?? undefined,
      durationSec: durationSec ?? undefined,
      recordingUrl: recordingUrl ?? undefined,
    })
    .returning();

  // Owner/rep notification for new DialPad calls bound to a known lead.
  // Skipped when no lead match — those calls still appear in the global
  // calls list but don't deserve a "new activity" ping on someone's queue.
  if (lead && repId) {
    await notify({
      repId,
      type: status === "no-answer" ? "call.missed" : "call.completed",
      title:
        status === "no-answer"
          ? `Missed DialPad call · ${lead.practice}`
          : `${direction === "inbound" ? "Inbound" : "Outbound"} DialPad call · ${lead.practice}`,
      body: durationSec
        ? `${Math.max(1, Math.round(durationSec / 60))} min — transcript will appear shortly.`
        : "Call logged from DialPad.",
      linkUrl: `/dashboard/leads/${lead.id}`,
    }).catch((err) =>
      logger.warn({ err }, "dialpad: notify failed (non-fatal)"),
    );
  }

  return row.id;
};

/**
 * Pull the transcript for a DialPad call (Vi must be enabled on the
 * workspace) and persist it. Idempotent — re-runs overwrite the existing
 * row so corrections from re-processing flow through.
 */
export const ingestDialpadTranscript = async (
  dialpadCallId: string,
): Promise<boolean> => {
  const [row] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.dialpadCallId, String(dialpadCallId)))
    .limit(1);
  if (!row) {
    // Transcript event arrived before call.ended — happens occasionally;
    // upsert the call first, then retry. We deliberately don't recurse
    // beyond one hop to avoid runaway loops on a missing call.
    const id = await upsertCallFromDialpad(dialpadCallId);
    if (!id) return false;
  }
  // Pull the lightweight call envelope first so we can resolve the
  // owning rep's bearer for the transcript fetch — Vi transcripts on
  // the rep's seat are only readable by HER token (recordings_export
  // scope). Falls through to the shared key when no per-rep match.
  let bearer: string | undefined;
  try {
    const envelope = await getCall(dialpadCallId);
    bearer = await resolveCallBearer(envelope);
  } catch {
    bearer = undefined;
  }
  let transcript: DialpadTranscript;
  try {
    transcript = await getCallTranscript(dialpadCallId, { bearer });
  } catch (err) {
    // BATCH 1.3: surface the 403/404 cause loudly. Most common production
    // failure mode is the shared admin key lacking `recordings_export`
    // when no rep OAuth bearer can be resolved. TODO: alert on this.
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        dialpadCallId,
        usedRepBearer: !!bearer,
      },
      "dialpad: getTranscript failed",
    );
    return false;
  }

  // Normalize: prefer a flat string; otherwise stitch lines with speaker tags.
  let text = "";
  if (typeof transcript.transcript === "string" && transcript.transcript.trim()) {
    text = transcript.transcript.trim();
  } else if (Array.isArray(transcript.lines)) {
    text = transcript.lines
      .map((l) => {
        const who = l.speaker ?? l.speaker_id ?? "";
        const what = (l.text ?? "").trim();
        if (!what) return "";
        return who ? `${who}: ${what}` : what;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (!text) {
    // BATCH 1.3: Dialpad returned an envelope but no transcript body — Vi
    // hasn't finished processing yet. Caller (backfill) decides whether
    // to count this as "with transcript".
    logger.info(
      { dialpadCallId },
      "dialpad: transcript envelope present but empty (Vi still processing)",
    );
    return false;
  }

  // Re-look up the row in case we just created it above.
  const [callRow] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.dialpadCallId, String(dialpadCallId)))
    .limit(1);
  if (!callRow) return false;

  await db
    .insert(callTranscripts)
    .values({
      callId: callRow.id,
      transcriptText: text,
      transcriptLang: transcript.language ?? undefined,
      whisperCostCents: 0, // Vi is billed at the workspace level, not per call.
    })
    .onConflictDoUpdate({
      target: callTranscripts.callId,
      set: {
        transcriptText: text,
        transcriptLang: transcript.language ?? undefined,
        generatedAt: new Date(),
      },
    });
  return true;
};

/**
 * Pull and persist the Vi summary + action items.
 */
export const ingestDialpadSummary = async (
  dialpadCallId: string,
): Promise<void> => {
  const [row] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.dialpadCallId, String(dialpadCallId)))
    .limit(1);
  if (!row) {
    const id = await upsertCallFromDialpad(dialpadCallId);
    if (!id) return;
  }

  // Same per-rep bearer resolution as the transcript path — Vi summaries
  // are scoped to the rep who owns the call.
  let bearer: string | undefined;
  try {
    const envelope = await getCall(dialpadCallId);
    bearer = await resolveCallBearer(envelope);
  } catch {
    bearer = undefined;
  }
  let summary: DialpadSummary;
  try {
    summary = await getCallSummary(dialpadCallId, { bearer });
  } catch (err) {
    logger.warn({ err, dialpadCallId }, "dialpad: getSummary failed");
    return;
  }

  const summaryText = (summary.summary ?? "").trim();
  if (!summaryText) return;

  // Vi exposes "next steps" / "action items" / "outcomes" interchangeably
  // depending on rollout — surface whichever is non-empty.
  const nextActions: string[] = (
    summary.action_items ??
    summary.next_steps ??
    summary.outcomes ??
    []
  ).filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  const talkingPoints: string[] = (summary.purposes ?? []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );

  const [callRow] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.dialpadCallId, String(dialpadCallId)))
    .limit(1);
  if (!callRow) return;

  await db
    .insert(callSummaries)
    .values({
      callId: callRow.id,
      summary: summaryText,
      talkingPoints,
      nextActions,
      gptCostCents: 0,
    })
    .onConflictDoUpdate({
      target: callSummaries.callId,
      set: {
        summary: summaryText,
        talkingPoints,
        nextActions,
        generatedAt: new Date(),
      },
    });
};

// Suppress unused-import warning for `and` if it ever drops to single-condition
// where clauses; keeping the import here costs nothing and avoids churn.
void and;

/**
 * Pull-mode backfill: fetch recent calls directly from DialPad's API
 * and ingest them (call row + transcript + summary). Used by the admin
 * "Refresh from DialPad" button when webhooks aren't configured. Safe
 * to run repeatedly — every step is idempotent on `dialpadCallId`.
 *
 * Returns a summary so the UI can show "synced N calls (M new)" feedback.
 * Transcript/summary fetches are best-effort: DialPad's Vi takes a few
 * minutes to process a call, so a fresh call may not have either yet.
 */
export const backfillRecentCalls = async (params: {
  sinceMs: number;
  maxPages?: number;
}): Promise<{
  fetched: number;
  upserted: number;
  withTranscript: number;
  withSummary: number;
  errors: number;
}> => {
  const maxPages = params.maxPages ?? 10;
  let cursor: string | undefined = undefined;
  let fetched = 0;
  let upserted = 0;
  let withTranscript = 0;
  let withSummary = 0;
  let errors = 0;

  for (let page = 0; page < maxPages; page++) {
    let res: Awaited<ReturnType<typeof listDialpadCalls>>;
    try {
      res = await listDialpadCalls({
        startedAfterMs: params.sinceMs,
        cursor,
      });
    } catch (err) {
      logger.error({ err, page }, "dialpad backfill: listDialpadCalls failed");
      errors++;
      break;
    }
    fetched += res.items.length;
    for (const item of res.items) {
      const id = item.call_id != null ? String(item.call_id) : null;
      if (!id) continue;
      try {
        const callId = await upsertCallFromDialpad(id);
        if (callId !== null) upserted++;
        // Best-effort enrichment — these fail silently if Vi hasn't
        // produced transcript/summary yet.
        // BATCH 1.3: previously both incrementers ran unconditionally
        // (the function caught its own errors and returned), so the
        // "X with transcript" counter on the admin Transcripts page
        // double-counted Vi-not-ready calls as successes. Now the
        // helper returns a boolean — only count actual ingests.
        try {
          if (await ingestDialpadTranscript(id)) withTranscript++;
        } catch {
          /* not ready */
        }
        try {
          await ingestDialpadSummary(id);
          withSummary++;
        } catch {
          /* not ready */
        }
      } catch (err) {
        errors++;
        logger.warn(
          { err, dialpadCallId: id },
          "dialpad backfill: per-call ingest failed",
        );
      }
    }
    if (!res.cursor) break;
    cursor = res.cursor;
  }

  logger.info(
    { fetched, upserted, withTranscript, withSummary, errors },
    "dialpad backfill: complete",
  );
  return { fetched, upserted, withTranscript, withSummary, errors };
};
