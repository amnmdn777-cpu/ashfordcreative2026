/**
 * @deprecated Retired 2026-04-27 (task #181). Not mounted in
 * routes/webhooks/index.ts. Kept on disk for the 30-day cleanup
 * window only — see follow-up #183 for deletion.
 */
import express, { Router, type IRouter } from "express";
import twilio from "twilio";
import { db, leads, twilioMessages, smsOptOuts } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { recordInboundSms, normalizePhone } from "../../integrations/twilio";
import { notify } from "../../services/notifications";
import { logger } from "../../lib/logger";
import { env, isProd } from "../../lib/env";

const router: IRouter = Router();

// Carrier-required compliance keywords (case-insensitive). The first word of
// the inbound body must match exactly to count — this matches Twilio Advanced
// Opt-Out behavior and the wording the FCC/CTIA recommend.
const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

/**
 * Compose carrier-compliance reply bodies on-demand so a live update to
 * `TWILIO_VOICE_NUMBER` flows through the STOP/HELP responses without a
 * code change. We format the number into a US-style display when it
 * looks domestic, otherwise leave the raw value alone.
 */
const formatVoiceNumber = (raw: string | undefined): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
};

const stopReply = (): string => {
  const voice = formatVoiceNumber(env.twilioVoiceNumber);
  return voice
    ? `You have been unsubscribed from Ashford Creative messages. For help, reply HELP or call ${voice}.`
    : "You have been unsubscribed from Ashford Creative messages. Reply HELP for help.";
};

const helpReply = (): string => {
  const voice = formatVoiceNumber(env.twilioVoiceNumber);
  const callLine = voice ? ` Call ${voice} for support.` : "";
  return `Ashford Creative — bilingual websites for Texas mental-health practices. Msg & data rates may apply. Reply STOP to unsubscribe.${callLine} Email hello@ashfordcreative.org for support.`;
};

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const twimlReply = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(body)}</Message></Response>`;
const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

const verifyTwilioSignature = (req: express.Request): boolean => {
  // Skip verification only when running locally without a token configured.
  if (!env.twilioAuthToken) {
    if (isProd) {
      logger.error("Twilio auth token missing in production — rejecting webhook");
      return false;
    }
    logger.warn("Twilio auth token missing — skipping signature verification (dev only)");
    return true;
  }
  const signature = req.get("X-Twilio-Signature");
  if (!signature) return false;
  // Reconstruct the public URL the request was sent to.
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

router.post(
  ["/webhooks/twilio/inbound", "/webhooks/twilio/sms"],
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      if (!verifyTwilioSignature(req)) {
        logger.warn({ url: req.originalUrl }, "Twilio inbound signature invalid");
        res.status(403).type("text/plain").send("invalid signature");
        return;
      }
      const body = req.body as Record<string, string>;
      const fromNumber = body.From;
      const toNumber = body.To;
      const messageBody = body.Body ?? "";
      const sid = body.MessageSid ?? "";

      // Compliance keyword detection — check the FIRST WORD of the body only.
      // (Twilio Advanced Opt-Out uses the whole body, but matching the first
      //  token is what carriers actually expect and avoids false positives
      //  like "Please don't STOP — I love it.")
      const firstWord = messageBody.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
      const isStop = STOP_KEYWORDS.has(firstWord);
      const isHelp = HELP_KEYWORDS.has(firstWord);

      // STOP must be honored as fast as possible: write the opt-out row BEFORE
      // any other lookup or notification work. This minimizes the race window
      // where a concurrent outbound `sendSms` could pass the opt-out check
      // between when STOP arrived and when we committed it. The unique index
      // on `phone` makes this idempotent on duplicate / replayed STOPs.
      if (isStop) {
        // Store in canonical E.164 form so outbound `isPhoneOptedOut` matches
        // even if a different code path passes the number in a non-canonical
        // user-entered form like `(512) 555-0100`.
        await db
          .insert(smsOptOuts)
          .values({
            phone: normalizePhone(fromNumber),
            source: "inbound_keyword",
            keyword: firstWord,
          })
          .onConflictDoNothing({ target: smsOptOuts.phone });
      }

      // Replay/duplicate dedupe: Twilio retries inbound webhooks on 5xx and
      // can occasionally re-deliver the same MessageSid. We treat the inbound
      // `twilio_messages` row as the source of truth — if we've already
      // recorded this sid, we send the carrier-required reply (still required
      // on every delivery) but skip persistence and notifications.
      let alreadySeen = false;
      if (sid) {
        const [seen] = await db
          .select({ id: twilioMessages.id })
          .from(twilioMessages)
          .where(
            and(
              eq(twilioMessages.twilioSid, sid),
              eq(twilioMessages.direction, "inbound"),
            ),
          )
          .limit(1);
        alreadySeen = !!seen;
      }

      if (alreadySeen) {
        // Reply with the same TwiML the original delivery returned so carriers
        // continue to see compliant behavior on retry.
        if (isStop) {
          res.type("text/xml").send(twimlReply(stopReply()));
        } else if (isHelp) {
          res.type("text/xml").send(twimlReply(helpReply()));
        } else {
          res.type("text/xml").send(twimlEmpty);
        }
        return;
      }

      // Always record the inbound message so the audit trail is complete even
      // for compliance traffic.
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.phone, fromNumber))
        .limit(1);

      let routedRepId: number | undefined;
      if (lead) {
        // Spec routing rule: route inbound replies to the rep who sent the most
        // recent OUTBOUND SMS to that lead.
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
        twilioSid: sid,
        leadId: lead?.id,
        repId: routedRepId,
      });

      if (isStop) {
        if (routedRepId) {
          await notify({
            repId: routedRepId,
            type: "sms.opt_out",
            title: `${lead?.practice ?? fromNumber} opted out of SMS`,
            body: `Inbound "${firstWord}" — we will not send further texts to this number.`,
            linkUrl: lead ? `/dashboard/leads/${lead.id}` : undefined,
          });
        }
        res.type("text/xml").send(twimlReply(stopReply()));
        return;
      }

      if (isHelp) {
        // Carrier-required HELP/INFO auto-response. Do not notify the rep —
        // this is a robotic exchange, not a real reply.
        res.type("text/xml").send(twimlReply(helpReply()));
        return;
      }

      // Real inbound reply — notify the routed rep if any.
      if (routedRepId) {
        await notify({
          repId: routedRepId,
          type: "sms.reply",
          title: `Reply from ${lead?.practice ?? fromNumber}`,
          body: messageBody.slice(0, 200),
          linkUrl: lead ? `/dashboard/leads/${lead.id}` : undefined,
        });
      }

      res.type("text/xml").send(twimlEmpty);
    } catch (err) {
      logger.error({ err }, "twilio inbound error");
      res.status(500).send("error");
    }
  },
);

router.post(
  "/webhooks/twilio/status",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      if (!verifyTwilioSignature(req)) {
        res.status(403).type("text/plain").send("invalid signature");
        return;
      }
      const body = req.body as Record<string, string>;
      const sid = body.MessageSid ?? "";
      const status = body.MessageStatus ?? "";
      if (sid) {
        // Map Twilio status -> our message_status enum where it overlaps.
        const mapped: "sent" | "delivered" | "failed" | null =
          status === "delivered"
            ? "delivered"
            : status === "failed" || status === "undelivered"
              ? "failed"
              : status === "sent"
                ? "sent"
                : null;
        if (mapped) {
          await db
            .update(twilioMessages)
            .set({ status: mapped })
            .where(eq(twilioMessages.twilioSid, sid));
        }
      }
      res.type("text/plain").send("ok");
    } catch (err) {
      logger.error({ err }, "twilio status webhook error");
      res.status(500).send("error");
    }
  },
);

export default router;
