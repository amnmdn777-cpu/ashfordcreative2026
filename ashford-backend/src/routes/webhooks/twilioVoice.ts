/**
 * @deprecated Retired 2026-04-27 (task #181). Not mounted in
 * routes/webhooks/index.ts. Kept on disk for the 30-day cleanup
 * window only — see follow-up #183 for deletion.
 */
import express, { Router, type IRouter, type Request } from "express";
import twilio from "twilio";
import { db, calls, leads } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { env, isProd } from "../../lib/env";
import {
  getNextRoundRobinRep,
  inboundRoutingTwiml,
  outboundConnectTwiml,
  applyStatusCallback,
  linkCallSid,
  calleeNoticeTwiml,
  voicemailTwiml,
  emptyTwiml,
} from "../../integrations/twilioVoice";
import { uploadAudioFromTwilioUrl } from "../../integrations/audioStorage";
import { transcribeCall } from "../../services/callTranscription";
import { isPhoneOptedOut, normalizePhone } from "../../integrations/twilio";

// Voice webhooks: inbound, outbound-twiml, status, recording, voicemail.
// All endpoints verify Twilio signatures and reuse the audio + Whisper pipeline.

const router: IRouter = Router();

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const twimlReject = (reason: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">${xmlEscape(reason)}</Say><Hangup/></Response>`;

const verifyTwilioSignature = (req: Request): boolean => {
  if (!env.twilioAuthToken) {
    if (isProd) {
      logger.error("Twilio auth token missing in production — rejecting voice webhook");
      return false;
    }
    logger.warn("Twilio auth token missing — skipping voice signature verification (dev only)");
    return true;
  }
  const signature = req.get("X-Twilio-Signature");
  if (!signature) return false;
  const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
  const host = req.get("x-forwarded-host") ?? req.get("host");
  const url = `${proto}://${host}${req.originalUrl}`;
  return twilio.validateRequest(
    env.twilioAuthToken,
    signature,
    url,
    req.body as Record<string, unknown>,
  );
};

const formParser = express.urlencoded({ extended: false });

// Inbound carrier webhook — seeds a calls row, returns routing TwiML.
router.post(
  "/webhooks/twilio/voice/inbound",
  formParser,
  async (req, res) => {
    if (!verifyTwilioSignature(req)) {
      logger.warn({ url: req.originalUrl }, "voice/inbound: signature invalid");
      res.status(403).type("text/plain").send("invalid signature");
      return;
    }
    try {
      const body = req.body as Record<string, string>;
      const fromNumber = body.From ?? "";
      const toNumber = body.To ?? "";
      const callSid = body.CallSid ?? "";

      // Lead match: exact normalized phone, then last-7-digit suffix; only on a single hit.
      let leadId: number | undefined;
      let leadDisplayName: string | undefined;
      let leadPracticeName: string | undefined;
      const normalizedFrom = normalizePhone(fromNumber);
      if (normalizedFrom) {
        const exact = await db
          .select({
            id: leads.id,
            name: leads.name,
            practice: leads.practice,
          })
          .from(leads)
          .where(eq(leads.phone, normalizedFrom))
          .limit(2);
        if (exact.length === 1) {
          leadId = exact[0].id;
          leadDisplayName = exact[0].name || undefined;
          leadPracticeName = exact[0].practice ?? undefined;
        } else if (exact.length === 0) {
          const digits = normalizedFrom.replace(/\D/g, "");
          if (digits.length >= 7) {
            const suffix = digits.slice(-7);
            const fuzzy = await db
              .select({
                id: leads.id,
                name: leads.name,
                practice: leads.practice,
              })
              .from(leads)
              .where(sql`right(regexp_replace(${leads.phone}, '\\D', '', 'g'), 7) = ${suffix}`)
              .limit(2);
            if (fuzzy.length === 1) {
              leadId = fuzzy[0].id;
              leadDisplayName = fuzzy[0].name || undefined;
              leadPracticeName = fuzzy[0].practice ?? undefined;
            }
          }
        }
      }

      const next = await getNextRoundRobinRep();
      const repIdentities = next ? [next.identity] : [];

      const [row] = await db
        .insert(calls)
        .values({
          leadId,
          repId: next?.repId,
          direction: "inbound",
          fromNumber: normalizedFrom,
          toNumber: normalizePhone(toNumber),
          twilioCallSid: callSid || undefined,
          status: "ringing",
        })
        .returning();

      const xml = inboundRoutingTwiml({
        callId: row.id,
        repIdentities,
        voicemailCallbackPath: "/api/webhooks/twilio/voice/voicemail-complete",
        recordingCallbackPath: "/api/webhooks/twilio/voice/recording-complete",
        clientParams: {
          callId: String(row.id),
          ...(leadId !== undefined ? { leadId: String(leadId) } : {}),
          ...(leadDisplayName ? { leadName: leadDisplayName.slice(0, 80) } : {}),
          ...(leadPracticeName
            ? { practiceName: leadPracticeName.slice(0, 80) }
            : {}),
        },
      });
      res.type("text/xml").send(xml);
    } catch (err) {
      logger.error({ err }, "voice/inbound: unexpected error");
      res.type("text/xml").send(twimlEmpty);
    }
  },
);

// Callee-notice — invoked via <Number url=...> on outbound, plays the
// bilingual recording disclosure to the *callee* (PSTN side) on answer
// before bridging. Public (no signature: Twilio fetches with no body
// to verify against, but we keep verification on for parity).
router.post(
  "/webhooks/twilio/voice/callee-notice",
  formParser,
  async (req, res) => {
    if (!verifyTwilioSignature(req)) {
      res.status(403).type("text/plain").send("invalid signature");
      return;
    }
    res.type("text/xml").send(calleeNoticeTwiml());
  },
);

// Inbound after-dial action — runs once the <Dial> finishes. Plays
// voicemail only on no-answer/busy/failed; otherwise the call is over.
router.post(
  "/webhooks/twilio/voice/inbound-after-dial",
  formParser,
  async (req, res) => {
    if (!verifyTwilioSignature(req)) {
      res.status(403).type("text/plain").send("invalid signature");
      return;
    }
    const body = (req.body ?? {}) as Record<string, string>;
    const dialStatus = body.DialCallStatus ?? "";
    const callIdParam = (req.query.callId as string) ?? "";
    const callId = Number(callIdParam);
    if (!Number.isInteger(callId)) {
      res.type("text/xml").send(emptyTwiml());
      return;
    }
    if (dialStatus === "no-answer" || dialStatus === "busy" || dialStatus === "failed") {
      res.type("text/xml").send(
        voicemailTwiml({
          callId,
          voicemailCallbackPath: "/api/webhooks/twilio/voice/voicemail-complete",
        }),
      );
      return;
    }
    // completed / answered / canceled — call ended normally, just hang up.
    res.type("text/xml").send(emptyTwiml());
  },
);

// Outbound dial-plan — TwiML App posts here; we re-check DNC server-side.
// Static URL is required (TwiML Apps don't support path templates); the
// legacy :callId path is kept so in-flight calls complete gracefully.
router.post(
  ["/webhooks/twilio/voice/outbound-twiml", "/webhooks/twilio/voice/outbound-twiml/:callId"],
  formParser,
  async (req, res) => {
    if (!verifyTwilioSignature(req)) {
      logger.warn({ url: req.originalUrl }, "voice/outbound-twiml: signature invalid");
      res.status(403).type("text/plain").send("invalid signature");
      return;
    }
    try {
      const body = (req.body ?? {}) as Record<string, string>;
      const rawCallId =
        req.params.callId ??
        body.callId ??
        body.callid ??
        (req.query.callId as string | undefined);
      const callId = Number(rawCallId);
      if (!Number.isInteger(callId)) {
        logger.warn(
          { params: req.params, bodyKeys: Object.keys(body), query: req.query },
          "voice/outbound-twiml: missing/invalid callId",
        );
        res.type("text/xml").send(twimlReject("Invalid call identifier."));
        return;
      }
      const [row] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
      if (!row) {
        res.type("text/xml").send(twimlReject("Call not found."));
        return;
      }

      const callSid = (req.body as Record<string, string>).CallSid;
      if (callSid && !row.twilioCallSid) {
        await linkCallSid(callId, callSid);
      }

      if (await isPhoneOptedOut(row.toNumber)) {
        await db.update(calls).set({ status: "failed" }).where(eq(calls.id, callId));
        res
          .type("text/xml")
          .send(twimlReject("This number has opted out and cannot be called."));
        return;
      }

      res.type("text/xml").send(
        outboundConnectTwiml({
          callId,
          toNumber: row.toNumber,
          recordingCallbackPath: "/api/webhooks/twilio/voice/recording-complete",
        }),
      );
    } catch (err) {
      logger.error({ err }, "voice/outbound-twiml: unexpected error");
      res.type("text/xml").send(twimlEmpty);
    }
  },
);

// Status-callback — keeps calls.status/durationSec/costCents in sync.
router.post(
  "/webhooks/twilio/voice/status-callback",
  formParser,
  async (req, res) => {
    if (!verifyTwilioSignature(req)) {
      res.status(403).type("text/plain").send("invalid signature");
      return;
    }
    try {
      const body = req.body as Record<string, string>;
      const sid = body.CallSid;
      // Child legs carry the parent callId via ?callId=; parent legs don't and are matched by CallSid.
      const callIdParam = (req.query.callId as string) ?? "";
      const scopedCallId = Number.isInteger(Number(callIdParam))
        ? Number(callIdParam)
        : undefined;
      if (sid) await applyStatusCallback(sid, body, scopedCallId);
    } catch (err) {
      logger.error({ err }, "voice/status-callback: error (swallowed)");
    }
    res.status(204).end();
  },
);

// Recording-complete — patches metadata, then uploads + transcribes in background.
router.post(
  "/webhooks/twilio/voice/recording-complete",
  formParser,
  async (req, res) => {
    if (!verifyTwilioSignature(req)) {
      res.status(403).type("text/plain").send("invalid signature");
      return;
    }
    try {
      const body = req.body as Record<string, string>;
      const callIdParam = (req.query.callId as string) ?? "";
      const callId = Number(callIdParam);
      if (!Number.isInteger(callId)) {
        logger.warn({ callIdParam }, "voice/recording-complete: bad callId param");
        res.status(204).end();
        return;
      }
      const recordingUrl = body.RecordingUrl;
      const recordingSid = body.RecordingSid;
      const recordingDurationSec = body.RecordingDuration ? Number(body.RecordingDuration) : null;
      if (!recordingUrl) {
        res.status(204).end();
        return;
      }

      await db
        .update(calls)
        .set({
          recordingUrl,
          recordingSid: recordingSid || undefined,
          recordingDurationSec:
            recordingDurationSec !== null && Number.isFinite(recordingDurationSec)
              ? recordingDurationSec
              : undefined,
        })
        .where(eq(calls.id, callId));

      res.status(204).end();

      void (async () => {
        const objectKey = `calls/${callId}/recording.mp3`;
        const stored = await uploadAudioFromTwilioUrl(recordingUrl, objectKey);
        if (stored) {
          await db
            .update(calls)
            .set({ recordingObjectKey: stored })
            .where(eq(calls.id, callId));
        }
        await transcribeCall(callId);
      })().catch((err) =>
        logger.error({ err, callId }, "voice/recording-complete: pipeline failed"),
      );
    } catch (err) {
      logger.error({ err }, "voice/recording-complete: unexpected");
      res.status(204).end();
    }
  },
);

// Voicemail-complete — same shape as recording-complete for VM-specific columns.
router.post(
  "/webhooks/twilio/voice/voicemail-complete",
  formParser,
  async (req, res) => {
    if (!verifyTwilioSignature(req)) {
      res.status(403).type("text/plain").send("invalid signature");
      return;
    }
    try {
      const body = req.body as Record<string, string>;
      const callIdParam = (req.query.callId as string) ?? "";
      const callId = Number(callIdParam);
      if (!Number.isInteger(callId)) {
        res.status(204).end();
        return;
      }
      const recordingUrl = body.RecordingUrl;
      const recordingSid = body.RecordingSid;
      const durationSec = body.RecordingDuration ? Number(body.RecordingDuration) : null;
      if (!recordingUrl) {
        res.status(204).end();
        return;
      }

      await db
        .update(calls)
        .set({
          voicemailUrl: recordingUrl,
          voicemailSid: recordingSid || undefined,
          voicemailDurationSec:
            durationSec !== null && Number.isFinite(durationSec) ? durationSec : undefined,
          status: "completed",
        })
        .where(eq(calls.id, callId));

      res.status(204).end();

      void (async () => {
        const objectKey = `voicemails/${callId}/voicemail.mp3`;
        const stored = await uploadAudioFromTwilioUrl(recordingUrl, objectKey);
        if (stored) {
          await db
            .update(calls)
            .set({ voicemailObjectKey: stored })
            .where(eq(calls.id, callId));
        }
        await transcribeCall(callId);
      })().catch((err) =>
        logger.error({ err, callId }, "voice/voicemail-complete: pipeline failed"),
      );
    } catch (err) {
      logger.error({ err }, "voice/voicemail-complete: unexpected");
      res.status(204).end();
    }
  },
);

export default router;
