/**
 * @deprecated Twilio voice retired 2026-04-27 (task #181).
 *
 * The active call-handling pipeline is `services/dialpadCallSync.ts`
 * (driven by the DialPad webhook in `routes/webhooks/dialpad.ts`).
 * Inbound calls now ring through the DialPad call-routing tree set up
 * for the team — there's no TwiML round-robin in the loop anymore.
 *
 * This module is retained because the legacy `routes/webhooks/twilioVoice.ts`
 * route (and the admin/voice routes that consume `getTwilioJwt`,
 * `pollRecordingStatus`, etc.) still mount; they short-circuit to 503
 * when `TWILIO_ACCOUNT_SID` is unset, which it now is in production.
 *
 * DO NOT add new imports from this file.
 */
import twilio, { jwt } from "twilio";
import { db, calls, salesReps } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { isPhoneOptedOut, normalizePhone } from "./twilio";
import { checkDailyCostCap } from "../services/voiceCostCap";

const restClient =
  env.twilioAccountSid && env.twilioAuthToken
    ? twilio(env.twilioAccountSid, env.twilioAuthToken)
    : null;

export const isVoiceConfigured = (): boolean =>
  !!(restClient && env.twilioVoiceNumber);

export const isVoiceAccessTokenConfigured = (): boolean =>
  !!(env.twilioApiKeySid && env.twilioApiKeySecret && env.twilioTwimlAppSid);

export const repClientIdentity = (repId: number): string => `rep-${repId}`;

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const RECORDING_NOTICE_EN =
  "Hello. This call may be recorded for quality and follow-up.";
const RECORDING_NOTICE_ES =
  "Hola. Esta llamada puede ser grabada con fines de calidad.";

const VOICEMAIL_GREETING_EN =
  "Hi, you've reached Ashford Creative. Leave us a message and we'll call you back today.";
const VOICEMAIL_GREETING_ES =
  "Hola, has llegado a Ashford Creative. Déjanos un mensaje y te llamaremos hoy.";

const callbackUrl = (path: string): string => {
  const base = env.publicBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Bilingual disclosure played to the *answering* party (called via the
// `url` attribute on <Number> for outbound, where it executes on the
// callee leg before the bridge).
export const calleeNoticeTwiml = (): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Say voice="alice" language="en-US">${xmlEscape(RECORDING_NOTICE_EN)}</Say>`,
    `<Say voice="alice" language="es-MX">${xmlEscape(RECORDING_NOTICE_ES)}</Say>`,
    "</Response>",
  ].join("");

// Inbound TwiML: rings the round-robin rep, records the bridged leg,
// and routes via `<Dial action=...>` so voicemail only plays on
// no-answer/busy/failed (never after a normally-completed call).
export const inboundRoutingTwiml = (params: {
  callId: number;
  repIdentities: string[];
  voicemailCallbackPath: string;
  recordingCallbackPath: string;
  /** TwiML <Parameter> entries injected into <Client> so the rep's
   *  browser dialer can render lead context (read via call.customParameters). */
  clientParams?: Record<string, string>;
}): string => {
  const {
    callId,
    repIdentities,
    voicemailCallbackPath,
    recordingCallbackPath,
    clientParams,
  } = params;
  const childStatusUrl = callbackUrl(
    `/api/webhooks/twilio/voice/status-callback?callId=${callId}`,
  );
  const childStatusAttrs =
    `statusCallback="${xmlEscape(childStatusUrl)}" ` +
    `statusCallbackEvent="initiated ringing answered completed" ` +
    `statusCallbackMethod="POST"`;
  const paramXml = clientParams
    ? Object.entries(clientParams)
        .map(
          ([k, v]) =>
            `<Parameter name="${xmlEscape(k)}" value="${xmlEscape(v)}"/>`,
        )
        .join("")
    : "";
  const dialChildren = repIdentities
    .slice(0, 1)
    .map(
      (id) =>
        `<Client ${childStatusAttrs}>${paramXml}<Identity>${xmlEscape(id)}</Identity></Client>`,
    )
    .join("");
  const voicemailUrl = callbackUrl(`${voicemailCallbackPath}?callId=${callId}`);
  const recordingUrl = callbackUrl(
    `${recordingCallbackPath}?callId=${callId}`,
  );
  // Inbound: the prospect IS the caller, so <Say> before <Dial> plays to them.
  if (repIdentities.length === 0) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<Response>",
      `<Say voice="alice" language="en-US">${xmlEscape(RECORDING_NOTICE_EN)}</Say>`,
      `<Say voice="alice" language="es-MX">${xmlEscape(RECORDING_NOTICE_ES)}</Say>`,
      `<Say voice="alice" language="en-US">${xmlEscape(VOICEMAIL_GREETING_EN)}</Say>`,
      `<Say voice="alice" language="es-MX">${xmlEscape(VOICEMAIL_GREETING_ES)}</Say>`,
      `<Record maxLength="120" playBeep="true" recordingStatusCallback="${xmlEscape(voicemailUrl)}" />`,
      "<Hangup/>",
      "</Response>",
    ].join("");
  }
  const afterDialUrl = callbackUrl(
    `/api/webhooks/twilio/voice/inbound-after-dial?callId=${callId}`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Say voice="alice" language="en-US">${xmlEscape(RECORDING_NOTICE_EN)}</Say>`,
    `<Say voice="alice" language="es-MX">${xmlEscape(RECORDING_NOTICE_ES)}</Say>`,
    `<Dial timeout="25" answerOnBridge="true" action="${xmlEscape(afterDialUrl)}" method="POST" record="record-from-answer-dual" recordingStatusCallback="${xmlEscape(recordingUrl)}" recordingStatusCallbackEvent="completed">`,
    dialChildren,
    "</Dial>",
    "</Response>",
  ].join("");
};

// Atomic round-robin pick across active+onboarded reps, ordered by oldest
// last_inbound_call_at; stamps now() so the next call rotates.
export const getNextRoundRobinRep = async (): Promise<{
  repId: number;
  identity: string;
} | null> => {
  const result = await db.execute<{ id: number }>(sql`
    UPDATE ${salesReps}
    SET last_inbound_call_at = now()
    WHERE id = (
      SELECT id FROM ${salesReps}
      WHERE is_active = true
      ORDER BY last_inbound_call_at ASC NULLS FIRST, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const rows = (result as unknown as { rows?: { id: number }[] }).rows;
  const row = rows && rows.length > 0 ? rows[0] : undefined;
  if (!row) return null;
  return { repId: row.id, identity: repClientIdentity(row.id) };
};

// Outbound TwiML: rep's Client → prospect's PSTN with dual-channel recording.
// `<Number url=...>` plays the disclosure to the *callee* on answer, before bridging
// (a <Say> before <Dial> would play to the rep instead).
export const outboundConnectTwiml = (params: {
  callId: number;
  toNumber: string;
  recordingCallbackPath: string;
}): string => {
  const { callId, toNumber, recordingCallbackPath } = params;
  const fromNumber = env.twilioVoiceNumber ?? "";
  const recordingUrl = callbackUrl(`${recordingCallbackPath}?callId=${callId}`);
  const childStatusUrl = callbackUrl(
    `/api/webhooks/twilio/voice/status-callback?callId=${callId}`,
  );
  const calleeNoticeUrl = callbackUrl(
    `/api/webhooks/twilio/voice/callee-notice`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Dial callerId="${xmlEscape(fromNumber)}" record="record-from-answer-dual" recordingStatusCallback="${xmlEscape(recordingUrl)}" recordingStatusCallbackEvent="completed" answerOnBridge="true">`,
    `<Number url="${xmlEscape(calleeNoticeUrl)}" method="POST" statusCallback="${xmlEscape(childStatusUrl)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${xmlEscape(toNumber)}</Number>`,
    "</Dial>",
    "</Response>",
  ].join("");
};

// Standalone voicemail TwiML — used as the no-answer fallback by inbound-after-dial.
export const voicemailTwiml = (params: {
  callId: number;
  voicemailCallbackPath: string;
}): string => {
  const url = callbackUrl(
    `${params.voicemailCallbackPath}?callId=${params.callId}`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Say voice="alice" language="en-US">${xmlEscape(VOICEMAIL_GREETING_EN)}</Say>`,
    `<Say voice="alice" language="es-MX">${xmlEscape(VOICEMAIL_GREETING_ES)}</Say>`,
    `<Record maxLength="120" playBeep="true" recordingStatusCallback="${xmlEscape(url)}" />`,
    "<Hangup/>",
    "</Response>",
  ].join("");
};

// Empty TwiML used by inbound-after-dial when the call connected normally.
export const emptyTwiml = (): string =>
  '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

export const getActiveRepIdentitiesForRouting = async (): Promise<string[]> => {
  const rows = await db
    .select({ id: salesReps.id })
    .from(salesReps)
    .where(
      and(
        eq(salesReps.isActive, true),
        // 2026-05-21 — `hasCompletedOnboarding` filter removed (Sprint 2 streamline).
      ),
    );
  return rows.map((r) => repClientIdentity(r.id));
};

export type CreateOutboundCallResult =
  | { ok: true; callId: number; callSid: string; status: string }
  | { ok: false; reason: "opted_out" | "cost_cap_blocked" | "voice_not_configured"; message: string };

// Server-side preflight for click-to-call: gates DNC + cost cap and seeds
// the calls row. Browser SDK places the actual call.
export const createOutboundCall = async (params: {
  leadId: number | null;
  repId: number;
  toNumber: string;
}): Promise<CreateOutboundCallResult> => {
  const { leadId, repId, toNumber } = params;

  if (!isVoiceConfigured()) {
    return {
      ok: false,
      reason: "voice_not_configured",
      message: "Voice channel not configured — set TWILIO_VOICE_NUMBER + Twilio credentials.",
    };
  }

  if (await isPhoneOptedOut(toNumber)) {
    logger.warn({ toNumber, repId, leadId }, "voice: outbound blocked (opted out)");
    return {
      ok: false,
      reason: "opted_out",
      message: "Lead has opted out (STOP) — outbound calls are blocked for compliance.",
    };
  }

  const status = await checkDailyCostCap();
  if (status.blocked) {
    logger.warn(
      { repId, usedCents: status.usedCents, capCents: status.capCents },
      "voice: outbound blocked (daily cap)",
    );
    return {
      ok: false,
      reason: "cost_cap_blocked",
      message: `Daily voice budget reached ($${(status.usedCents / 100).toFixed(2)} of $${(status.capCents / 100).toFixed(2)}).`,
    };
  }

  const [row] = await db
    .insert(calls)
    .values({
      leadId: leadId ?? undefined,
      repId,
      direction: "outbound",
      fromNumber: env.twilioVoiceNumber ?? "",
      toNumber: normalizePhone(toNumber),
      status: "queued",
    })
    .returning();

  return { ok: true, callId: row.id, callSid: "", status: "queued" };
};

// 1h Twilio Access Token (JWT) for the browser Voice SDK with
// outgoing VoiceGrant (TwiML App) + incoming Client identity.
export const mintAccessToken = (repId: number): { token: string; identity: string; expiresInSec: number } => {
  if (!isVoiceAccessTokenConfigured()) {
    throw new Error(
      "Voice access tokens not configured — TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID are required.",
    );
  }
  const identity = repClientIdentity(repId);
  const ttlSec = 3600;
  const AccessToken = jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const grant = new VoiceGrant({
    outgoingApplicationSid: env.twilioTwimlAppSid!,
    incomingAllow: true,
  });
  const token = new AccessToken(
    env.twilioAccountSid!,
    env.twilioApiKeySid!,
    env.twilioApiKeySecret!,
    { identity, ttl: ttlSec },
  );
  token.addGrant(grant);
  return { token: token.toJwt(), identity, expiresInSec: ttlSec };
};

// Apply a Twilio status-callback to the calls row. Twilio reports Price
// as a string in dollars (often negative — account balance delta); we
// invert and convert to integer cents. Idempotent on CallSid so retries
// and child-leg callbacks can't double-count the daily ledger.
export const applyStatusCallback = async (
  callSid: string,
  body: Record<string, string>,
  scopedCallId?: number,
): Promise<void> => {
  const status = body.CallStatus;
  const durationSec = body.CallDuration ? Number(body.CallDuration) : null;
  const priceStr = body.Price;
  const startedAt = body.StartTime ? new Date(body.StartTime) : null;
  const endedAt = body.EndTime ? new Date(body.EndTime) : null;

  let costCents = 0;
  if (priceStr) {
    const dollars = Math.abs(Number(priceStr));
    if (Number.isFinite(dollars)) costCents = Math.round(dollars * 100);
  }

  const updates: Partial<typeof calls.$inferInsert> = {};
  if (status && isCallStatus(status)) updates.status = status;
  if (durationSec !== null && Number.isFinite(durationSec))
    updates.durationSec = durationSec;
  if (startedAt && !Number.isNaN(startedAt.getTime())) updates.startedAt = startedAt;
  if (endedAt && !Number.isNaN(endedAt.getTime())) updates.endedAt = endedAt;

  if (costCents > 0) {
    const targetWhere =
      scopedCallId !== undefined
        ? eq(calls.id, scopedCallId)
        : eq(calls.twilioCallSid, callSid);
    await db
      .update(calls)
      .set({
        costCents: sql`${calls.costCents} + ${costCents}`,
        processedBillingSids: sql`coalesce(${calls.processedBillingSids}, '[]'::jsonb) || to_jsonb(${callSid}::text)`,
      })
      .where(
        and(
          targetWhere,
          sql`NOT (coalesce(${calls.processedBillingSids}, '[]'::jsonb) ? ${callSid})`,
        ),
      );
  }

  if (Object.keys(updates).length === 0) return;

  if (scopedCallId !== undefined) {
    await db.update(calls).set(updates).where(eq(calls.id, scopedCallId));
  } else {
    await db.update(calls).set(updates).where(eq(calls.twilioCallSid, callSid));
  }
};

type CallStatus = NonNullable<typeof calls.$inferInsert.status>;
const STATUSES = new Set<CallStatus>([
  "queued",
  "ringing",
  "in-progress",
  "completed",
  "no-answer",
  "busy",
  "failed",
  "canceled",
]);
const isCallStatus = (s: string): s is CallStatus =>
  (STATUSES as Set<string>).has(s);

// Stitch Twilio's CallSid back to our pre-seeded calls row on the first
// outbound webhook (browser SDK creates the call, so we don't have the SID at insert).
export const linkCallSid = async (callId: number, callSid: string): Promise<void> => {
  await db
    .update(calls)
    .set({ twilioCallSid: callSid })
    .where(eq(calls.id, callId));
};
