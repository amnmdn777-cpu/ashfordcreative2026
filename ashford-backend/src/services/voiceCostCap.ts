/**
 * @deprecated Twilio voice retired 2026-04-27 — DialPad billing handles
 * cost tracking on its own dashboard, so this in-app cap is no longer
 * the production safeguard. We keep the file because the legacy
 * `routes/webhooks/twilioVoice.ts` still imports `checkDailyCostCap`
 * to short-circuit deprecated paths. Do not extend this module.
 */
import { db, calls, callTranscripts, callSummaries, salesReps } from "@workspace/db";
import { sql, gte, eq, desc } from "drizzle-orm";
import { env } from "../lib/env";

export type VoiceCostStatus = {
  /** Total spend in cents since midnight America/Chicago today. */
  usedCents: number;
  /** Configured cap in cents (TWILIO_DAILY_COST_CAP_USD * 100). */
  capCents: number;
  /** True when usage has hit or exceeded the cap. */
  blocked: boolean;
  /** Number of calls that contributed to the window. */
  callCount: number;
  /** Total connected minutes across those calls. */
  connectedMinutes: number;
  /** ISO8601 instant the current window started (00:00:00 America/Chicago). */
  windowStart: string;
};

/**
 * Compute the most recent "midnight America/Chicago" instant as a UTC
 * Date. Twilio bills are summed against this rolling boundary so the
 * daily cap always resets at the same wall-clock moment for the Austin-
 * based business — regardless of where the Node process is hosted (UTC
 * dynos, US-East replicas, etc).
 *
 * Implementation: we use the platform's `Intl` formatter to render
 * "now" in the Chicago zone, snap the time-of-day fields to 00:00:00,
 * and convert the formatted local timestamp back to UTC by parsing
 * with the resolved offset. Done with Intl rather than a date library
 * to avoid a new dependency for one call site.
 */
const midnightCentralUtc = (now: Date = new Date()): Date => {
  // Render the current instant as a local Chicago timestamp, then
  // re-parse with the explicit offset to recover the exact UTC moment
  // that "today at 00:00 CT" represents — this handles DST automatically
  // because the offset comes from the formatter at *now*.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Resolved offset from the formatter looks like "GMT-05:00" (CDT) or
  // "GMT-06:00" (CST). Strip the "GMT" prefix so it concatenates cleanly
  // into an ISO-8601 string the Date constructor accepts.
  const tzName = get("timeZoneName");
  const offset = tzName.replace(/^GMT/, "") || "+00:00";
  // Construct an ISO timestamp that pins midnight in CT for today; the
  // Date constructor converts it to the UTC instant for us.
  return new Date(`${y}-${m}-${d}T00:00:00${offset}`);
};

/**
 * Sum the day-to-date voice spend across the three pipeline cost lines:
 * Twilio call minutes (`calls.cost_cents`), Whisper transcription
 * (`call_transcripts.whisper_cost_cents`), and GPT summarisation
 * (`call_summaries.gpt_cost_cents`). Returns a snapshot the admin widget
 * can render and the outbound dialer can gate on. Window resets at
 * 00:00 America/Chicago every day.
 */
export const checkDailyCostCap = async (): Promise<VoiceCostStatus> => {
  const since = midnightCentralUtc();

  const [callsAgg] = await db
    .select({
      cost: sql<number>`coalesce(sum(${calls.costCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(${calls.durationSec}), 0)::int`,
    })
    .from(calls)
    .where(gte(calls.createdAt, since));

  const [whisperAgg] = await db
    .select({
      cost: sql<number>`coalesce(sum(${callTranscripts.whisperCostCents}), 0)::int`,
    })
    .from(callTranscripts)
    .where(gte(callTranscripts.generatedAt, since));

  const [gptAgg] = await db
    .select({
      cost: sql<number>`coalesce(sum(${callSummaries.gptCostCents}), 0)::int`,
    })
    .from(callSummaries)
    .where(gte(callSummaries.generatedAt, since));

  const usedCents =
    (callsAgg?.cost ?? 0) + (whisperAgg?.cost ?? 0) + (gptAgg?.cost ?? 0);
  const capCents = Math.round(env.twilioDailyCostCapUsd * 100);

  return {
    usedCents,
    capCents,
    blocked: usedCents >= capCents,
    callCount: callsAgg?.count ?? 0,
    connectedMinutes: Math.round((callsAgg?.minutes ?? 0) / 60),
    windowStart: since.toISOString(),
  };
};

/**
 * Per-rep breakdown of day-to-date spend (since midnight America/Chicago)
 * for the admin "Voice today" widget drill-down. Only includes reps who
 * actually made a call in the window, so the table stays compact even
 * with a large roster.
 */
export const dailyCostByRep = async (): Promise<
  Array<{ repId: number; displayName: string; calls: number; cents: number; minutes: number }>
> => {
  const since = midnightCentralUtc();
  const rows = await db
    .select({
      repId: calls.repId,
      displayName: salesReps.displayName,
      calls: sql<number>`count(*)::int`,
      cents: sql<number>`coalesce(sum(${calls.costCents}), 0)::int`,
      minutes: sql<number>`coalesce(sum(${calls.durationSec}), 0)::int`,
    })
    .from(calls)
    .leftJoin(salesReps, eq(salesReps.id, calls.repId))
    .where(gte(calls.createdAt, since))
    .groupBy(calls.repId, salesReps.displayName)
    .orderBy(desc(sql<number>`coalesce(sum(${calls.costCents}), 0)`));

  return rows
    .filter((r) => r.repId !== null)
    .map((r) => ({
      repId: r.repId as number,
      displayName: r.displayName ?? `Rep #${r.repId}`,
      calls: r.calls,
      cents: r.cents,
      minutes: Math.round(r.minutes / 60),
    }));
};
