import express, { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, leads, twilioMessages } from "@workspace/db";
import { logger } from "../../lib/logger";
import { env, isProd } from "../../lib/env";
import {
  isDialpadSmsConfigured,
  isDialpadSmsWebhookConfigured,
  isOptOutBody,
  normalizePhone,
  recordInboundSms,
  recordOptOut,
  verifyWebhookJwt,
} from "../../integrations/dialpad";
import { notify } from "../../services/notifications";

/**
 * DialPad inbound-SMS webhook. JWT-signed body (HS256), mounted with
 * express.text() so the raw token survives. STOP/UNSUBSCRIBE/CANCEL/
 * END/QUIT trigger an opt-out write before any other DB work to win
 * the race against an in-flight outbound sendSms. Replay-safe via
 * provider message id.
 */

type SmsPayload = {
  event_type?: string;
  type?: string;
  // Common DialPad SMS fields — the exact key set varies by event
  // version. We accept any of the historical names and pick the first
  // one that's present.
  message_id?: string | number;
  id?: string | number;
  from_number?: string;
  to_number?: string;
  text?: string;
  body?: string;
  message?: string;
  contact?: { phone?: string } | null;
};

const router: IRouter = Router();

const ack = (res: express.Response, status = 200): void => {
  res.status(status).json({ ok: status === 200 });
};

router.post(
  "/webhooks/dialpad/sms",
  express.text({ type: "*/*", limit: "256kb" }),
  async (req, res) => {
    // 503 (vs 200) when not configured so the DialPad admin's "test
    // webhook" button surfaces the misconfiguration loudly instead of
    // looking healthy.
    if (!isDialpadSmsConfigured() || !isDialpadSmsWebhookConfigured()) {
      if (isProd) {
        logger.error(
          "dialpad sms webhook hit but integration not configured",
        );
      }
      ack(res, 503);
      return;
    }

    const raw = typeof req.body === "string" ? req.body : "";
    if (!raw) {
      ack(res, 400);
      return;
    }

    const decoded = verifyWebhookJwt(raw, env.dialpadSmsWebhookSecret!);
    if (!decoded) {
      logger.warn(
        { len: raw.length },
        "dialpad sms: webhook signature/format invalid",
      );
      res.status(401).type("text/plain").send("invalid signature");
      return;
    }

    // DialPad wraps the SMS payload under varying keys depending on
    // subscription version (`payload`, `data`, or root). Accept all.
    const payload: SmsPayload =
      ((decoded.payload as SmsPayload) ??
        (decoded.data as SmsPayload) ??
        (decoded as unknown as SmsPayload));

    const fromNumber = normalizePhone(
      payload.from_number ?? payload.contact?.phone ?? "",
    );
    const toNumber = normalizePhone(payload.to_number ?? "");
    const messageBody = payload.text ?? payload.body ?? payload.message ?? "";
    const providerId =
      payload.message_id != null
        ? String(payload.message_id)
        : payload.id != null
          ? String(payload.id)
          : "";

    if (!fromNumber || !providerId) {
      logger.warn(
        { hasFrom: !!fromNumber, hasId: !!providerId },
        "dialpad sms: incomplete inbound payload — ack and drop",
      );
      ack(res);
      return;
    }

    // ACK before doing any DB work so the upstream timeout budget isn't
    // burned on lookups. The only synchronous step is the opt-out write,
    // which we DO want to flush before the response: an opt-out that
    // races with a same-request outbound send would let one final text
    // through. Cheap to keep it inline.
    if (isOptOutBody(messageBody)) {
      await recordOptOut(fromNumber);
      logger.info(
        { fromNumber },
        "dialpad sms: opt-out keyword received and recorded",
      );
    }

    // Replay/dedupe: DialPad retries on 5xx and can occasionally
    // re-deliver the same message. Treat the persisted twilio_messages
    // row as the source of truth.
    const [existing] = await db
      .select({ id: twilioMessages.id })
      .from(twilioMessages)
      .where(
        and(
          eq(twilioMessages.twilioSid, providerId),
          eq(twilioMessages.direction, "inbound"),
        ),
      )
      .limit(1);
    if (existing) {
      ack(res);
      return;
    }

    // Lead lookup + rep routing — same rule as the Twilio handler:
    // the rep who sent the most recent OUTBOUND SMS to this lead is the
    // one notified. Falls back to no-rep when we have no prior outbound.
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.phone, fromNumber))
      .limit(1);

    let routedRepId: number | undefined;
    if (lead) {
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
      routedRepId = lastOut?.repId ?? undefined;
    }

    await recordInboundSms({
      fromNumber,
      toNumber,
      body: messageBody,
      providerId,
      leadId: lead?.id,
      repId: routedRepId,
    });

    // Notify the routed rep so the dashboard's "new message" badge
    // increments in real time. We only enqueue when a rep was routed
    // (notify requires a repId); inbound from an unknown number lands
    // silently in the messages table for the next person who scans it.
    if (routedRepId) {
      void notify({
        repId: routedRepId,
        type: "inbound_sms",
        title: lead ? `${lead.name} replied` : "New SMS reply",
        body: messageBody.slice(0, 140),
        linkUrl: lead ? `/dashboard/leads/${lead.id}` : undefined,
      }).catch((err) => {
        logger.error({ err }, "dialpad sms: notify failed (non-fatal)");
      });
    }

    ack(res);
  },
);

export default router;
