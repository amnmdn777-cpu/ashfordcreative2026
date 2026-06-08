import express, { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, leads, twilioMessages } from "@workspace/db";
import { logger } from "../../lib/logger";
import { isProd } from "../../lib/env";
import {
  isTextbeltConfigured,
  isTextbeltLiveKey,
  verifyTextbeltSignature,
} from "../../integrations/textbelt";
import {
  isOptOutBody,
  normalizePhone,
  recordInboundSms,
  recordOptOut,
} from "../../integrations/dialpad";
import { notify } from "../../services/notifications";

/**
 * TextBelt inbound-SMS webhook. Mounted at POST /api/webhooks/textbelt/sms.
 *
 * Payload (JSON):
 *   { textId: "12345", fromNumber: "+15558675309", text: "yes please" }
 *
 * Auth: HMAC-SHA256 over `${timestamp}${rawBody}` with the API key as
 * secret. Headers: X-Textbelt-Signature (hex), X-Textbelt-Timestamp
 * (unix seconds). We require a paid TEXTBELT_API_KEY to be present —
 * the free "textbelt" tier does not produce reply webhooks at all, so
 * any inbound hit while unconfigured is by definition spoofed.
 *
 * Lead/rep routing: TextBelt's `textId` matches the twilio_sid we
 * stored at send time, which is already linked to the originating
 * lead+rep. No phone-number lookup required (the rep that sent the
 * outbound is automatically the rep that owns the reply).
 */

type TextbeltReplyPayload = {
  textId?: string | number;
  fromNumber?: string;
  text?: string;
  data?: string;
};

const router: IRouter = Router();

const ack = (res: express.Response, status = 200): void => {
  res.status(status).json({ ok: status === 200 });
};

router.post(
  "/webhooks/textbelt/sms",
  // Capture the raw body for signature verification. We re-parse it as
  // JSON ourselves below — express.json() would consume the stream and
  // leave nothing for HMAC.
  express.text({ type: "*/*", limit: "256kb" }),
  async (req, res) => {
    if (!isTextbeltConfigured()) {
      if (isProd) {
        logger.error("textbelt webhook hit but integration not configured");
      }
      ack(res, 503);
      return;
    }

    const raw = typeof req.body === "string" ? req.body : "";
    if (!raw) {
      ack(res, 400);
      return;
    }

    const sigOk = verifyTextbeltSignature({
      signatureHeader: req.header("x-textbelt-signature") ?? undefined,
      timestampHeader: req.header("x-textbelt-timestamp") ?? undefined,
      rawBody: raw,
    });
    if (!sigOk) {
      logger.warn(
        {
          len: raw.length,
          live: isTextbeltLiveKey(),
        },
        "textbelt webhook: signature invalid",
      );
      res.status(401).type("text/plain").send("invalid signature");
      return;
    }

    let payload: TextbeltReplyPayload;
    try {
      payload = JSON.parse(raw) as TextbeltReplyPayload;
    } catch {
      ack(res, 400);
      return;
    }

    const textId =
      payload.textId != null ? String(payload.textId).trim() : "";
    const fromNumber = normalizePhone(payload.fromNumber ?? "");
    const messageBody = (payload.text ?? payload.data ?? "").trim();

    if (!textId || !fromNumber) {
      logger.warn(
        { hasTextId: !!textId, hasFrom: !!fromNumber },
        "textbelt webhook: incomplete payload — ack and drop",
      );
      ack(res);
      return;
    }

    // Opt-out keywords — written before any other DB work so a STOP
    // racing with an in-flight outbound still wins.
    if (isOptOutBody(messageBody)) {
      await recordOptOut(fromNumber);
      logger.info(
        { fromNumber },
        "textbelt sms: opt-out keyword received and recorded",
      );
    }

    // Replay/dedupe — TextBelt retries on 5xx. Same provider id +
    // direction means we've already processed this reply.
    const [existing] = await db
      .select({ id: twilioMessages.id })
      .from(twilioMessages)
      .where(
        and(
          eq(twilioMessages.twilioSid, textId),
          eq(twilioMessages.direction, "inbound"),
        ),
      )
      .limit(1);
    if (existing) {
      ack(res);
      return;
    }

    // Lead+rep routing: look up the original outbound row by textId.
    // The textId TextBelt sends in the reply matches the textId we
    // stored as twilio_sid at send time. Falls back to a phone lookup
    // for the (rare) case where the outbound row was wiped.
    const [originatingOutbound] = await db
      .select({
        leadId: twilioMessages.leadId,
        repId: twilioMessages.repId,
        toNumber: twilioMessages.toNumber,
      })
      .from(twilioMessages)
      .where(
        and(
          eq(twilioMessages.twilioSid, textId),
          eq(twilioMessages.direction, "outbound"),
        ),
      )
      .limit(1);

    let leadId = originatingOutbound?.leadId ?? null;
    let repId = originatingOutbound?.repId ?? null;
    const toNumber = originatingOutbound?.toNumber ?? "";

    if (!leadId) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.phone, fromNumber))
        .limit(1);
      if (lead) {
        leadId = lead.id;
        const [lastOut] = await db
          .select()
          .from(twilioMessages)
          .where(
            and(
              eq(twilioMessages.leadId, lead.id),
              eq(twilioMessages.direction, "outbound"),
            ),
          )
          .orderBy(desc(twilioMessages.occurredAt))
          .limit(1);
        repId = lastOut?.repId ?? null;
      }
    }

    await recordInboundSms({
      fromNumber,
      toNumber,
      body: messageBody,
      providerId: textId,
      leadId: leadId ?? undefined,
      repId: repId ?? undefined,
    });

    if (repId) {
      void notify({
        repId,
        type: "inbound_sms",
        title: "New SMS reply",
        body: messageBody.slice(0, 140),
        linkUrl: leadId ? `/leads/${leadId}` : undefined,
        payload: { leadId, fromNumber, textId },
      });
    }

    ack(res);
  },
);

export default router;
