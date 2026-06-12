import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, twilioMessages, smsOptOuts } from "@workspace/db";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import {
  isSmsMobileApiConfigured,
  sendSmsViaSmsMobileApi,
} from "./smsMobileApi";
import {
  isTextbeltConfigured,
  sendSmsViaTextbelt,
} from "./textbelt";
import {
  getRepDialpadAccessToken,
  isDialpadOauthConfigured,
  type RepDialpadConnection,
} from "./dialpadOAuth";

/**
 * DialPad Telephony API client + webhook helpers. Soft-fails when
 * DIALPAD_API_KEY is unset (boot stays green; webhook returns 503).
 * Webhook bodies are JWT (HS256) — verify with verifyWebhookJwt.
 * Vi transcripts/summaries arrive as separate *.processed events.
 */

export const isDialpadConfigured = (): boolean => !!env.dialpadApiKey;

export const isDialpadWebhookConfigured = (): boolean =>
  !!env.dialpadWebhookSecret;

const apiBase = (): string => env.dialpadApiBaseUrl.replace(/\/$/, "");

type DialpadFetchOpts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
  /**
   * Auth context for the request. Default is the shared system key
   * (`DIALPAD_API_KEY`) — kept for back-office actions, webhook
   * subscription bootstrap, admin sync jobs.
   *
   * - `{ repId }` → use the rep's per-rep OAuth bearer (auto-refreshed
   *   if within 5 min of expiry). Falls back to the shared key only
   *   when the rep has not connected. Pass `requireRepAuth: true` to
   *   refuse to fall back (used for rep-initiated outbound calls/SMS).
   * - `{ repToken }` → caller already resolved a `RepDialpadConnection`
   *   (e.g. webhook ingest path that looked up the owning rep by
   *   dialpadUserId) and wants to use that bearer directly.
   */
  auth?:
    | { kind: "shared" }
    | { kind: "rep"; repId: number; requireRepAuth?: boolean }
    | { kind: "repToken"; bearer: string };
};

const resolveBearer = async (
  opts: DialpadFetchOpts,
): Promise<{ bearer: string; source: "shared" | "rep" }> => {
  const auth = opts.auth ?? { kind: "shared" };
  if (auth.kind === "repToken") {
    return { bearer: auth.bearer, source: "rep" };
  }
  if (auth.kind === "rep") {
    if (isDialpadOauthConfigured()) {
      const conn = await getRepDialpadAccessToken(auth.repId);
      if (conn) return { bearer: conn.accessToken, source: "rep" };
    }
    if (auth.requireRepAuth) {
      throw new Error(
        "DIALPAD_NOT_CONNECTED: rep must connect Dialpad before placing this request",
      );
    }
  }
  if (!env.dialpadApiKey) {
    throw new Error("DialPad not configured (DIALPAD_API_KEY missing)");
  }
  return { bearer: env.dialpadApiKey, source: "shared" };
};

const dialpadFetch = async <T>(
  path: string,
  opts: DialpadFetchOpts = {},
): Promise<T> => {
  const { bearer } = await resolveBearer(opts);
  const url = new URL(`${apiBase()}/api/v2${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `DialPad ${opts.method ?? "GET"} ${path} failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }
  // DELETE returns 204 No Content — only json-parse when there's a body.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

// ---- Telephony API surface we need -----------------------------------------
//
// Schemas are intentionally typed loosely (Record<string, unknown>) — DialPad
// adds fields over time and we only key on the ones we use. Concrete shapes
// are validated at the consumption site (services/dialpadCallSync.ts) where
// missing fields fall back to safe defaults.

export type DialpadCall = Record<string, unknown> & {
  call_id: string | number;
  direction?: string;
  state?: string;
  internal_number?: string | null;
  external_number?: string | null;
  contact?: { phone?: string; name?: string } | null;
  date_started?: string | number | null;
  date_connected?: string | number | null;
  date_ended?: string | number | null;
  duration?: number | null;
  total_duration?: number | null;
  recording_url?: string | string[] | null;
  recording_details?: Array<{ url?: string }> | null;
  target?: { id?: string | number } | null;
  // Vi fields (when AI add-on is on)
  transcription_text?: string | null;
};

export const getCall = async (
  callId: string | number,
  opts: { repId?: number; bearer?: string } = {},
): Promise<DialpadCall> =>
  dialpadFetch<DialpadCall>(`/call/${encodeURIComponent(String(callId))}`, {
    auth: opts.bearer
      ? { kind: "repToken", bearer: opts.bearer }
      : opts.repId !== undefined
        ? { kind: "rep", repId: opts.repId }
        : { kind: "shared" },
  });

/**
 * Paginated list of recent calls from DialPad's API. Used by the admin
 * "Refresh from DialPad" button as a pull-mode alternative to the
 * webhook-driven sync (which requires DIALPAD_WEBHOOK_SECRET + a
 * workspace-level webhook registration). Returns one page at a time —
 * caller paginates via `cursor`.
 */
export const listDialpadCalls = async (params: {
  startedAfterMs: number;
  cursor?: string;
  limit?: number;
}): Promise<{
  items: DialpadCall[];
  cursor: string | null;
}> => {
  const res = await dialpadFetch<{
    items?: DialpadCall[];
    cursor?: string | null;
  }>(`/call`, {
    auth: { kind: "shared" },
    query: {
      started_after: params.startedAfterMs,
      limit: params.limit ?? 100,
      cursor: params.cursor,
    },
  });
  return {
    items: Array.isArray(res.items) ? res.items : [],
    cursor: res.cursor ?? null,
  };
};

export type DialpadTranscript = {
  call_id: string | number;
  // Either a flat text field or a list of speaker-tagged moments depending
  // on the account's Vi version. We accept both and normalize downstream.
  transcript?: string | null;
  lines?: Array<{
    text?: string;
    speaker?: string;
    speaker_id?: string;
    time?: number;
  }> | null;
  language?: string | null;
};

export const getCallTranscript = async (
  callId: string | number,
  opts: { repId?: number; bearer?: string } = {},
): Promise<DialpadTranscript> =>
  dialpadFetch<DialpadTranscript>(
    `/transcripts/${encodeURIComponent(String(callId))}`,
    {
      auth: opts.bearer
        ? { kind: "repToken", bearer: opts.bearer }
        : opts.repId !== undefined
          ? { kind: "rep", repId: opts.repId }
          : { kind: "shared" },
    },
  );

export type DialpadSummary = {
  call_id: string | number;
  summary?: string | null;
  // Vi exposes structured outputs under a few different keys depending on
  // the rollout — we read whichever is present.
  action_items?: string[] | null;
  next_steps?: string[] | null;
  purposes?: string[] | null;
  outcomes?: string[] | null;
  sentiment?: string | null;
};

export const getCallSummary = async (
  callId: string | number,
  opts: { repId?: number; bearer?: string } = {},
): Promise<DialpadSummary> =>
  dialpadFetch<DialpadSummary>(
    `/callsummaries/${encodeURIComponent(String(callId))}`,
    {
      auth: opts.bearer
        ? { kind: "repToken", bearer: opts.bearer }
        : opts.repId !== undefined
          ? { kind: "rep", repId: opts.repId }
          : { kind: "shared" },
    },
  );

// ---- Webhook subscription management ---------------------------------------

/** Voice configured = shared Dialpad API key + the placing user + a
 * from-number. Used for system / admin paths only — per-rep voice
 * configuration is checked separately via {@link isRepDialpadVoiceConfigured}. */
export const isDialpadVoiceConfigured = (): boolean =>
  !!(env.dialpadApiKey && env.dialpadUserId && env.dialpadFromNumber);

/**
 * Per-rep voice availability. Returns the connection if the rep has
 * an active Dialpad OAuth token, else null. The Call button on the
 * rep dashboard is gated on this AND the daily cost cap.
 */
export const getRepDialpadVoice = async (
  repId: number,
): Promise<RepDialpadConnection | null> => {
  if (!isDialpadOauthConfigured()) return null;
  return getRepDialpadAccessToken(repId);
};

// ASH-11: the call API has NO `device_type` field — passing one is a no-op,
// so Dialpad rings ALL of the rep's devices and the deskphone/handheld grabs
// the call. To keep the call on the computer we must ring a single device by
// `device_id`. List the user's devices and prefer a software client (desktop
// / web app) over a physical deskphone. Returns null (→ ring all, legacy
// behavior) when the lookup fails or no suitable device is found.
type DialpadUserDevice = {
  id?: string | number;
  type?: string | null;
  name?: string | null;
};
// Software clients we want the call to land on.
const COMPUTER_DEVICE_RE = /desktop|web|app|cti|soft/i;
// Physical phones we want to avoid auto-answering.
const PHYSICAL_DEVICE_RE = /deskphone|hardphone|sip|cell|mobile/i;
const resolveComputerDeviceId = async (
  userId: string | number,
  auth: DialpadFetchOpts["auth"],
): Promise<string | null> => {
  try {
    const res = await dialpadFetch<{ items?: DialpadUserDevice[] }>(
      `/userdevices`,
      { query: { user_id: userId }, auth },
    );
    const devices = res.items ?? [];
    // Logged so we can confirm the exact device `type` strings against a live
    // seat and tighten the matching if needed.
    logger.info(
      {
        userId,
        devices: devices.map((d) => ({ id: d.id, type: d.type, name: d.name })),
      },
      "dialpad: user devices for outbound ring (ASH-11)",
    );
    const pick =
      devices.find((d) => COMPUTER_DEVICE_RE.test(String(d.type ?? ""))) ??
      devices.find((d) => !PHYSICAL_DEVICE_RE.test(String(d.type ?? "")));
    return pick?.id != null ? String(pick.id) : null;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), userId },
      "dialpad: userdevices lookup failed — falling back to ring-all",
    );
    return null;
  }
};

/**
 * Dialpad click-to-call. Server tells Dialpad to ring the rep's
 * registered Dialpad device first, then bridge to `toNumber`. No
 * browser SDK needed (unlike Twilio Voice). Returns the dialpad call_id
 * the inbound webhook will later reference for transcript / summary.
 *
 * When `repId` is provided AND that rep has connected her Dialpad,
 * the call is placed under HER OAuth token from HER own Dialpad seat
 * — the prospect sees HER caller-id, not the shared admin number.
 * The shared key path is reserved for system contexts (admin Candice's
 * own actions when she hasn't done OAuth, automated re-attempts, etc).
 */
export const placeDialpadCall = async (params: {
  toNumber: string;
  /** Logged-in rep placing the call. When set AND she has a per-rep
   * Dialpad connection, the call uses HER token + dialpad user_id +
   * caller-id; otherwise we fall back to the shared admin credentials
   * (legacy behavior). */
  repId?: number;
  /** Force per-rep auth — throws DIALPAD_NOT_CONNECTED when the rep
   * hasn't connected. Used by the rep dashboard's Call button so we
   * never silently dial out from Candice's number on the rep's behalf. */
  requireRepAuth?: boolean;
}): Promise<{ call_id: string | number; status?: string }> => {
  // Per-rep path: use her token + her dialpad user_id.
  if (params.repId !== undefined && isDialpadOauthConfigured()) {
    const conn = await getRepDialpadAccessToken(params.repId);
    if (conn) {
      const auth = { kind: "repToken" as const, bearer: conn.accessToken };
      // ASH-11: ring the rep's computer/app device specifically.
      const deviceId = await resolveComputerDeviceId(conn.dialpadUserId, auth);
      return dialpadFetch<{ call_id: string | number; status?: string }>(
        `/call`,
        {
          method: "POST",
          // Per-rep call: omit `outbound_caller_id` so Dialpad uses
          // the rep's own primary line as the caller-id (the whole
          // point of OAuth — the prospect must see HER number, not the
          // shared `DIALPAD_FROM_NUMBER`).
          body: {
            user_id: conn.dialpadUserId,
            phone_number: normalizePhoneE164(params.toNumber),
            ...(deviceId ? { device_id: deviceId } : {}),
          },
          auth,
        },
      );
    }
    if (params.requireRepAuth) {
      throw new Error(
        "DIALPAD_NOT_CONNECTED: connect your Dialpad before placing calls",
      );
    }
  }
  // Shared / legacy path.
  if (!isDialpadVoiceConfigured()) {
    throw new Error("Dialpad voice not configured");
  }
  // ASH-11: ring the shared user's computer/app device specifically.
  const sharedDeviceId = await resolveComputerDeviceId(env.dialpadUserId!, {
    kind: "shared",
  });
  return dialpadFetch<{ call_id: string | number; status?: string }>(`/call`, {
    method: "POST",
    body: {
      user_id: env.dialpadUserId!,
      phone_number: normalizePhoneE164(params.toNumber),
      ...(sharedDeviceId ? { device_id: sharedDeviceId } : {}),
      outbound_caller_id: env.dialpadFromNumber!,
    },
  });
};

const normalizePhoneE164 = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

export type DialpadWebhook = {
  id: string;
  hook_url: string;
  secret?: string;
};

/**
 * Create (or look up by hook_url) a webhook destination. DialPad returns
 * the same `id` on subsequent POSTs with the same hook_url.
 */
export const upsertWebhook = async (
  hookUrl: string,
  secret: string,
): Promise<DialpadWebhook> =>
  dialpadFetch<DialpadWebhook>(`/webhooks`, {
    method: "POST",
    body: { hook_url: hookUrl, secret },
  });

/**
 * Subscribe a webhook to call events (state changes, ended, recording, etc).
 * Without this subscription DialPad won't fire any call.* event to our hook.
 */
export const subscribeCallEvents = async (
  webhookId: string,
): Promise<unknown> =>
  dialpadFetch(`/subscriptions/call`, {
    method: "POST",
    body: {
      webhook_id: webhookId,
      // "all" = every state change. We filter server-side in the handler so
      // operators can see the full event stream when debugging.
      enabled: true,
      group_calls_only: false,
    },
  });

/**
 * Vi event subscriptions — fired when DialPad finishes processing a call
 * through Voice Intelligence (transcript + summary). Separate endpoint
 * because Vi is an opt-in add-on; not every workspace has it.
 */
export const subscribeVoiceIntelligence = async (
  webhookId: string,
): Promise<unknown> =>
  dialpadFetch(`/subscriptions/transcript`, {
    method: "POST",
    body: { webhook_id: webhookId, enabled: true },
  }).catch((err) => {
    // Workspaces without the AI add-on return 403 here — log and continue
    // so call.* logging still works without Vi.
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "dialpad: voice-intelligence subscription failed (Vi add-on may be off)",
    );
    return null;
  });

// ---- Signature verification ------------------------------------------------

/**
 * Verify a DialPad webhook payload. DialPad signs the entire request body
 * as a compact JWT (HS256) using the shared secret. We do constant-time
 * signature comparison and re-decode the payload — never trust the raw body.
 *
 * Returns the decoded payload on success, `null` on any failure (bad
 * format, bad signature, expired). Callers MUST treat null as 401.
 */
export const verifyWebhookJwt = (
  rawBody: string,
  secret: string,
): Record<string, unknown> | null => {
  const token = rawBody.trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8")) as Record<
      string,
      unknown
    >;
    payload = JSON.parse(
      base64UrlDecode(payloadB64).toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  let provided: Buffer;
  try {
    provided = base64UrlDecode(sigB64);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  // Optional exp check (DialPad sets `iat` but not always `exp`; we honor
  // exp when present so a leaked token can't be replayed forever).
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return null;
  }
  return payload;
};

const base64UrlDecode = (input: string): Buffer => {
  // RFC 4648 §5 -> standard base64
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
};

// SMS — outbound + inbound. We reuse the `twilio_messages` table as a
// provider-agnostic store; `twilio_sid` now holds the DialPad message id.

/** Outbound SMS is fully wired (creds + from-number set). */
export const isDialpadSmsConfigured = (): boolean =>
  !!(env.dialpadApiKey && env.dialpadUserId && env.dialpadFromNumber);

export const isDialpadSmsWebhookConfigured = (): boolean =>
  !!env.dialpadSmsWebhookSecret;

/** Canonicalize a phone to E.164 (US default). Mirrors the Twilio shim
 * so call sites can swap the import without changing the format on disk.
 * Stripped down here because we only use it for the from/to columns —
 * the provider does its own validation upstream. */
export const normalizePhone = (phone: string): string => {
  const trimmed = (phone ?? "").trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

/** STOP / UNSUBSCRIBE / CANCEL keyword check on inbound SMS bodies.
 * Carriers in the US treat these as binding regardless of platform — we
 * persist the opt-out before logging the message so a subsequent
 * outbound attempt within the same request is suppressed. */
const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
]);

export const isOptOutBody = (body: string): boolean => {
  const trimmed = body.trim().toLowerCase();
  // Match exact keyword OR keyword as the first word of a longer message
  // ("STOP please stop texting me") to align with carrier behavior.
  const firstWord = trimmed.split(/\s+/)[0] ?? "";
  return OPT_OUT_KEYWORDS.has(firstWord);
};

export const isPhoneOptedOut = async (phone: string): Promise<boolean> => {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const [row] = await db
    .select({ id: smsOptOuts.id })
    .from(smsOptOuts)
    .where(eq(smsOptOuts.phone, normalized))
    .limit(1);
  return !!row;
};

export type SendSmsParams = {
  to: string;
  body: string;
  leadId?: number;
  repId?: number;
  /** Optional rep first-name to append a personal sign-off line. */
  fromRepFirstName?: string;
  /** When true AND the SMS path resolves to Dialpad (i.e. TextBelt is not
   * configured) AND per-rep OAuth is enabled, REQUIRE the rep to have
   * connected her own Dialpad seat. Without it we throw
   * `DIALPAD_NOT_CONNECTED` instead of silently falling back to the
   * shared admin number — the prospect must always reply to HER inbox.
   *
   * The TextBelt path is unaffected because TextBelt SMS does not use
   * Dialpad credentials at all (separate provider with its own number). */
  requireRepAuth?: boolean;
};

export type SendSmsResult = {
  /** Auto-incrementing PK from twilio_messages — used by the dashboard
   * to link the rep activity row back to the message. */
  id: number;
  /** Logical status: `sent` | `dev_skipped` | `opted_out` | `failed`. */
  status: "sent" | "dev_skipped" | "opted_out" | "failed";
  /** Provider-side message id (DialPad's `id` field) when sent.
   * Returned as `sid` (not `messageId`) to keep call-site compatibility
   * with the legacy Twilio shim — both names existed in the codebase. */
  sid: string | null;
};

/** Send an SMS via DialPad. Soft-fails when DialPad isn't configured
 * (logs warning, persists row with status='dev_skipped', returns).
 *
 * The `twilio_messages` row is written in every code path so the
 * dashboard's message log is always complete — even when the upstream
 * call failed or the recipient is opted out. The `error_message` column
 * captures the failure reason for the rep UI. */
export const sendSms = async (
  params: SendSmsParams,
): Promise<SendSmsResult> => {
  // For the timeline display, prefer the SMS Mobile API "from number" if
  // configured (operators sometimes set this to the phone the SMS Mobile
  // app is paired with). Otherwise fall back to the legacy DialPad
  // outbound number, then to a sentinel so the NOT NULL column is happy.
  const fromNumber =
    env.dialpadFromNumber ?? "+15555550100";
  const finalBody = params.fromRepFirstName
    ? `${params.body}\n\n— ${params.fromRepFirstName}, Ashford Creative`
    : params.body;

  // Suppress sends to opted-out numbers (carrier compliance). We still
  // persist the row so the rep can see the suppression in the dashboard.
  if (await isPhoneOptedOut(params.to)) {
    logger.warn(
      { to: params.to, leadId: params.leadId, repId: params.repId },
      "sms suppressed — recipient has opted out (STOP)",
    );
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "dev_skipped",
        errorMessage: "recipient_opted_out",
      })
      .returning();
    return { id: row.id, status: "opted_out", sid: null };
  }

  // ---- Per-rep override (task #226) -------------------------------------
  // When the caller demands per-rep auth AND per-rep OAuth is configured,
  // we MUST go out under HER Dialpad seat — TextBelt would send from a
  // shared brand number, defeating the entire point of the OAuth flow.
  // Force the Dialpad branch below by skipping TextBelt; if the rep
  // hasn't connected, the explicit DIALPAD_NOT_CONNECTED throw a few
  // lines down surfaces the right error to the rep.
  const forceDialpadForRep =
    params.requireRepAuth === true &&
    params.repId !== undefined &&
    isDialpadOauthConfigured();

  // ---- Primary path: TextBelt (textbelt.com) ----------------------------
  // TextBelt is a managed HTTP SMS gateway: they hold the carrier-
  // registered numbers + 10DLC brand, so we don't need our own carrier
  // approval. Replies are signed-webhook'd to /api/webhooks/textbelt/sms
  // when a paid key is configured. With the free "textbelt" fallback key,
  // sends are rate-limited to 1/IP/day and replies are not delivered.
  if (isTextbeltConfigured() && !forceDialpadForRep) {
    const result = await sendSmsViaTextbelt({
      to: params.to,
      message: finalBody,
      leadId: params.leadId,
      repId: params.repId,
    });
    if (result.ok) {
      const [row] = await db
        .insert(twilioMessages)
        .values({
          direction: "outbound",
          fromNumber,
          toNumber: params.to,
          body: finalBody,
          leadId: params.leadId,
          repId: params.repId,
          status: "sent",
          twilioSid: result.textId,
        })
        .returning();
      return { id: row.id, status: "sent", sid: result.textId };
    }
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "failed",
        errorMessage: result.error ?? "textbelt_unknown_error",
      })
      .returning();
    return { id: row.id, status: "failed", sid: null };
  }

  // ---- Fallback path #1: SMS Mobile API (legacy, requires phone-app) ----
  // Kept only as an automatic fallback; primary path is TextBelt above.
  // See env.ts for the deprecation note.
  if (isSmsMobileApiConfigured() && !forceDialpadForRep) {
    const result = await sendSmsViaSmsMobileApi({
      to: params.to,
      message: finalBody,
      leadId: params.leadId,
      repId: params.repId,
    });
    if (result.ok) {
      const [row] = await db
        .insert(twilioMessages)
        .values({
          direction: "outbound",
          fromNumber,
          toNumber: params.to,
          body: finalBody,
          leadId: params.leadId,
          repId: params.repId,
          status: "sent",
          twilioSid: result.messageId,
        })
        .returning();
      return { id: row.id, status: "sent", sid: result.messageId };
    }
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "failed",
        errorMessage: result.error ?? "sms_mobile_api_unknown_error",
      })
      .returning();
    return { id: row.id, status: "failed", sid: null };
  }

  // ---- Fallback path: DialPad SMS (dormant when SMS Mobile API is set) --
  if (!isDialpadSmsConfigured()) {
    logger.warn(
      { to: params.to, body: finalBody.slice(0, 80) },
      "no outbound sms provider configured — persisting as dev_skipped",
    );
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "dev_skipped",
      })
      .returning();
    return { id: row.id, status: "dev_skipped", sid: null };
  }

  try {
    // Per-rep path: when the acting rep has connected her Dialpad, send
    // from HER seat (her user_id + her bearer) so the prospect sees HER
    // number — and the inbound reply lands in HER Dialpad inbox, not
    // the shared admin one.
    let repConn: RepDialpadConnection | null = null;
    if (params.repId !== undefined && isDialpadOauthConfigured()) {
      repConn = await getRepDialpadAccessToken(params.repId);
    }
    // When the caller demands per-rep auth (e.g. rep-initiated SMS via
    // /dashboard/sms/send) and the rep hasn't connected, REFUSE rather
    // than send from the shared admin seat. This is the SMS counterpart
    // to placeDialpadCall's `requireRepAuth` and the same posture task
    // #226 takes for the voice channel.
    if (params.requireRepAuth && !repConn && isDialpadOauthConfigured()) {
      throw new Error(
        "DIALPAD_NOT_CONNECTED: connect your Dialpad before sending SMS",
      );
    }
    type DialpadSmsResponse = { id?: string | number };
    const sent = await dialpadFetch<DialpadSmsResponse>("/sms", {
      method: "POST",
      body: {
        user_id: repConn ? Number(repConn.dialpadUserId) : Number(env.dialpadUserId),
        to_numbers: [params.to],
        text: finalBody,
        infer_country_code: true,
      },
      auth: repConn
        ? { kind: "repToken", bearer: repConn.accessToken }
        : { kind: "shared" },
    });
    const providerId = sent.id != null ? String(sent.id) : null;
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "sent",
        twilioSid: providerId,
      })
      .returning();
    return { id: row.id, status: "sent", sid: providerId };
  } catch (err) {
    // The DIALPAD_NOT_CONNECTED guard is a configuration/permission
    // error, not a provider failure — re-throw so the route layer can
    // surface a structured 409 ("Connect your Dialpad in Settings…")
    // instead of a misleading "failed" message log row.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("DIALPAD_NOT_CONNECTED")) {
      throw err;
    }
    logger.error({ err, to: params.to }, "dialpad sms send failed");
    const [row] = await db
      .insert(twilioMessages)
      .values({
        direction: "outbound",
        fromNumber,
        toNumber: params.to,
        body: finalBody,
        leadId: params.leadId,
        repId: params.repId,
        status: "failed",
        errorMessage: msg,
      })
      .returning();
    return { id: row.id, status: "failed", sid: null };
  }
};

/** Persist an inbound SMS event from the DialPad webhook. Mirrors the
 * Twilio inbound recorder so the message log shows both directions
 * regardless of which provider delivered the text. */
export const recordInboundSms = async (params: {
  fromNumber: string;
  toNumber: string;
  body: string;
  providerId: string;
  leadId?: number;
  repId?: number;
}) => {
  const [row] = await db
    .insert(twilioMessages)
    .values({
      direction: "inbound",
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      body: params.body,
      leadId: params.leadId,
      repId: params.repId,
      status: "received",
      twilioSid: params.providerId,
    })
    .returning();
  return row;
};

/** Insert (or no-op on dup) an opt-out record for a phone. Called from
 * the inbound webhook when the body matches a STOP keyword. */
export const recordOptOut = async (phone: string): Promise<void> => {
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  await db
    .insert(smsOptOuts)
    .values({ phone: normalized, source: "sms_inbound" })
    .onConflictDoNothing();
};
